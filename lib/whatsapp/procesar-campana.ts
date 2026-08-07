// lib/whatsapp/procesar-campana.ts

import db from "@/lib/db";

import { enviarUnMensajeWhatsapp } from "@/lib/whatsapp/envio";

import {
  iniciarWhatsappParaEnvio,
  esSesionWhatsappTemporal,
  cerrarYEliminarWhatsappTemporal,
} from "@/lib/whatsapp/playwright";

export const CAMPANA_HEARTBEAT_MS = 15_000;
export const CAMPANA_STALE_MS = 90_000;

type Campana = {
  id: number;
  numero_salida: string;
  estado: string;
  total_seleccionados: number;
  total_preparados: number;
  total_sin_telefono: number;
  total_fallidos: number;
  total_enviados: number;
  ultima_actividad: string | null;
};

type Destinatario = {
  id: number;
  idc: string;
  cliente: string | null;
  telefono_destino: string | null;
  mensaje: string | null;
  estado: string;
};

type EstadoFinal = "ENVIADA" | "ENVIADA_CON_ERRORES" | "ERROR";

type Conteo = {
  total: number;
  preparados: number;
  enviados: number;
  errores: number;
  sinTelefono: number;
  pendientes: number;
};

type ResultadoProceso = {
  ok: boolean;
  campanaId: number;
  estado: EstadoFinal;
  total: number;
  enviados: number;
  fallidos: number;
  reintentados: number;
  reanudado: boolean;
  resultados: Array<{
    id: number;
    idc: string;
    cliente: string | null;
    telefonoDestino: string | null;
    estado: "ENVIADO" | "ERROR";
    detalle: string;
    duracionMs: number;
    intentos: number;
  }>;
  limpiezaTemporal: string | null;
};

function inicializarMigracion6138() {
  try {
    db.exec(`ALTER TABLE whatsapp_campanas ADD COLUMN ultima_actividad TEXT`);
  } catch { }
}

function obtenerCampana(campanaId: number): Campana | undefined {
  inicializarMigracion6138();

  return db
    .prepare(
      `
    SELECT
      id,
      numero_salida,
      estado,
      total_seleccionados,
      total_preparados,
      total_sin_telefono,
      total_fallidos,
      total_enviados,
      ultima_actividad
    FROM whatsapp_campanas
    WHERE id = ?
    LIMIT 1
  `,
    )
    .get(campanaId) as Campana | undefined;
}

function actualizarHeartbeat(campanaId: number) {
  db.prepare(
    `
    UPDATE whatsapp_campanas
    SET ultima_actividad = ?
    WHERE id = ?
  `,
  ).run(new Date().toISOString(), campanaId);
}

function contarEstados(campanaId: number): Conteo {
  const fila = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total,
      SUM(
        CASE
          WHEN estado = 'PREPARADO' THEN 1
          ELSE 0
        END
      ) AS preparados,
      SUM(
        CASE
          WHEN estado = 'ENVIADO' THEN 1
          ELSE 0
        END
      ) AS enviados,
      SUM(
        CASE
          WHEN estado = 'ERROR' THEN 1
          ELSE 0
        END
      ) AS errores,
      SUM(
        CASE
          WHEN estado = 'SIN_TELEFONO' THEN 1
          ELSE 0
        END
      ) AS sinTelefono,
      SUM(
        CASE
          WHEN estado NOT IN (
            'PREPARADO',
            'ENVIADO',
            'ERROR',
            'SIN_TELEFONO'
          ) THEN 1
          ELSE 0
        END
      ) AS pendientes
    FROM whatsapp_campana_destinatarios
    WHERE campana_id = ?
  `,
    )
    .get(campanaId) as {
      total: number | null;
      preparados: number | null;
      enviados: number | null;
      errores: number | null;
      sinTelefono: number | null;
      pendientes: number | null;
    };

  return {
    total: Number(fila?.total ?? 0),
    preparados: Number(fila?.preparados ?? 0),
    enviados: Number(fila?.enviados ?? 0),
    errores: Number(fila?.errores ?? 0),
    sinTelefono: Number(fila?.sinTelefono ?? 0),
    pendientes: Number(fila?.pendientes ?? 0),
  };
}

function determinarEstadoFinal(conteo: Conteo): EstadoFinal {
  if (conteo.total > 0 && conteo.enviados === conteo.total) {
    return "ENVIADA";
  }

  if (conteo.enviados > 0) {
    return "ENVIADA_CON_ERRORES";
  }

  return "ERROR";
}

function sincronizarFinal(
  campanaId: number,
  forzarError: boolean,
): {
  estado: EstadoFinal;
  conteo: Conteo;
} {
  const conteo = contarEstados(campanaId);

  let estado: EstadoFinal;

  if (forzarError && (conteo.preparados > 0 || conteo.pendientes > 0)) {
    estado = "ERROR";
  } else if (conteo.preparados > 0 || conteo.pendientes > 0) {
    estado = "ENVIADA_CON_ERRORES";
  } else {
    estado = determinarEstadoFinal(conteo);
  }

  db.prepare(
    `
    UPDATE whatsapp_campanas
    SET
      total_preparados = ?,
      total_fallidos = ?,
      total_enviados = ?,
      estado = ?,
      ultima_actividad = ?
    WHERE id = ?
  `,
  ).run(
    Math.max(conteo.preparados, 0),
    conteo.errores + conteo.sinTelefono + conteo.preparados + conteo.pendientes,
    conteo.enviados,
    estado,
    new Date().toISOString(),
    campanaId,
  );

  return {
    estado,
    conteo,
  };
}

function errorEsReintentable(detalle: string): boolean {
  const texto = detalle.toLowerCase();

  const claves = [
    "timeout",
    "timed out",
    "navigation",
    "network",
    "net::",
    "connection",
    "conexión",
    "context was closed",
    "page was closed",
    "browser has been closed",
    "target page",
    "target closed",
    "socket",
    "protocol error",
    "temporarily",
    "temporal",
  ];

  return claves.some((clave) => texto.includes(clave));
}

function esCampanaObsoleta(campana: Campana): boolean {
  if (campana.estado !== "ENVIANDO") {
    return false;
  }

  if (!campana.ultima_actividad) {
    return true;
  }

  const marca = Date.parse(campana.ultima_actividad);

  if (Number.isNaN(marca)) {
    return true;
  }

  return Date.now() - marca > CAMPANA_STALE_MS;
}

async function reclamarCampana(
  campanaId: number,
  numeroSalida: string,
  modo: "NUEVA" | "REANUDAR",
): Promise<boolean> {
  const permitirEstado = `
    estado IN (
      'PREPARADA',
      'PREPARADA_CON_ERRORES'
      ${modo === "REANUDAR"
      ? `,
      'ENVIANDO',
      'ERROR',
      'ENVIADA_CON_ERRORES'`
      : ""
    }
    )
  `;

  const ahora = new Date().toISOString();

  const resultado = db
    .prepare(
      `
      UPDATE whatsapp_campanas
      SET
        estado = 'ENVIANDO',
        ultima_actividad = ?
      WHERE id = ?
        AND ${permitirEstado}
        AND NOT EXISTS (
          SELECT 1
          FROM whatsapp_campanas otra
          WHERE otra.id <>
            whatsapp_campanas.id
            AND otra.numero_salida =
              whatsapp_campanas.numero_salida
            AND otra.estado =
              'ENVIANDO'
            AND (
              otra.ultima_actividad IS NULL
              OR julianday(?) -
                 julianday(
                   otra.ultima_actividad
                 )
                 <= ?
            )
        )
    `,
    )
    .run(ahora, campanaId, ahora, CAMPANA_STALE_MS / 86400000);

  if (resultado.changes !== 1) {
    return false;
  }

  const pendientes = db
    .prepare(
      `
      SELECT
        COUNT(*) AS cantidad
      FROM whatsapp_campana_destinatarios
      WHERE campana_id = ?
        AND estado = 'PREPARADO'
    `,
    )
    .get(campanaId) as {
      cantidad: number;
    };

  if (Number(pendientes.cantidad) === 0) {
    sincronizarFinal(campanaId, false);

    return false;
  }

  if (!numeroSalida) {
    return false;
  }

  return true;
}

async function procesarCampana(
  campanaId: number,
  modo: "NUEVA" | "REANUDAR",
): Promise<ResultadoProceso> {
  inicializarMigracion6138();

  const campanaAntes = obtenerCampana(campanaId);

  if (!campanaAntes) {
    throw new Error("La campaña no existe.");
  }

  if (
    modo === "NUEVA" &&
    campanaAntes.estado !== "PREPARADA" &&
    campanaAntes.estado !== "PREPARADA_CON_ERRORES"
  ) {
    throw new Error(
      `La campaña no está disponible para envío. Estado actual: ${campanaAntes.estado}.`,
    );
  }

  if (modo === "REANUDAR") {
    const reanudable =
      campanaAntes.estado === "ERROR" ||
      campanaAntes.estado === "ENVIADA_CON_ERRORES" ||
      esCampanaObsoleta(campanaAntes);

    if (!reanudable) {
      throw new Error(
        "La campaña no está interrumpida ni disponible para reanudación.",
      );
    }
  }

  const campana = obtenerCampana(campanaId);

  if (!campana) {
    throw new Error("La campaña no existe.");
  }

  const reclamada = await reclamarCampana(
    campanaId,
    campana.numero_salida,
    modo,
  );

  if (!reclamada) {
    throw new Error(
      `El número de salida ${campana.numero_salida} está ocupado o la campaña no tiene destinatarios pendientes.`,
    );
  }

  const sesionTemporal = esSesionWhatsappTemporal(campana.numero_salida);

  const estadoWhatsapp = await iniciarWhatsappParaEnvio(
    campana.numero_salida,
    sesionTemporal,
  );

  if (!estadoWhatsapp.conectado) {
    db.prepare(
      `
      UPDATE whatsapp_campanas
      SET
        estado = 'ERROR',
        ultima_actividad = ?
      WHERE id = ?
    `,
    ).run(new Date().toISOString(), campanaId);

    throw new Error(
      `El número de salida ${campana.numero_salida} no está conectado a WhatsApp Web.`,
    );
  }

  const destinatarios = db
    .prepare(
      `
      SELECT
        id,
        idc,
        cliente,
        telefono_destino,
        mensaje,
        estado
      FROM whatsapp_campana_destinatarios
      WHERE campana_id = ?
        AND estado = 'PREPARADO'
      ORDER BY id ASC
    `,
    )
    .all(campanaId) as Destinatario[];

  if (destinatarios.length === 0) {
    const final = sincronizarFinal(campanaId, false);

    return {
      ok: final.estado === "ENVIADA",
      campanaId,
      estado: final.estado,
      total: final.conteo.total,
      enviados: final.conteo.enviados,
      fallidos:
        final.conteo.errores +
        final.conteo.sinTelefono +
        final.conteo.preparados +
        final.conteo.pendientes,
      reintentados: 0,
      reanudado: modo === "REANUDAR",
      resultados: [],
      limpiezaTemporal: null,
    };
  }

  let reintentados = 0;

  const resultados: ResultadoProceso["resultados"] = [];

  const heartbeat = setInterval(() => {
    try {
      actualizarHeartbeat(campanaId);
    } catch { }
  }, CAMPANA_HEARTBEAT_MS);

  try {
    for (const destinatario of destinatarios) {
      actualizarHeartbeat(campanaId);

      const telefono = destinatario.telefono_destino ?? "";

      const mensaje = destinatario.mensaje ?? "";

      if (!telefono || !mensaje.trim()) {
        db.prepare(
          `
          UPDATE whatsapp_campana_destinatarios
          SET
            estado = 'ERROR',
            error = ?,
            fecha_procesamiento = ?,
            duracion_ms = ?
          WHERE id = ?
            AND campana_id = ?
            AND estado = 'PREPARADO'
        `,
        ).run(
          "Falta teléfono o mensaje.",
          new Date().toISOString(),
          0,
          destinatario.id,
          campanaId,
        );

        resultados.push({
          id: destinatario.id,
          idc: destinatario.idc,
          cliente: destinatario.cliente,
          telefonoDestino: destinatario.telefono_destino,
          estado: "ERROR",
          detalle: "Falta teléfono o mensaje.",
          duracionMs: 0,
          intentos: 1,
        });

        continue;
      }

      let ultimoDetalle = "";

      let ultimoTiempo = 0;

      let enviado = false;

      for (let intento = 1; intento <= 2; intento++) {
        const inicio = Date.now();

        try {
          const resultado = await enviarUnMensajeWhatsapp(
            campana.numero_salida,
            telefono,
            mensaje,
          );

          ultimoTiempo = resultado.duracionMs;

          ultimoDetalle = resultado.detalle;

          if (resultado.ok) {
            enviado = true;

            db.prepare(
              `
              UPDATE whatsapp_campana_destinatarios
              SET
                estado = 'ENVIADO',
                error = NULL,
                fecha_procesamiento = ?,
                mensaje = ?,
                duracion_ms = ?
              WHERE id = ?
                AND campana_id = ?
                AND estado = 'PREPARADO'
            `,
            ).run(
              new Date().toISOString(),
              mensaje,
              resultado.duracionMs,
              destinatario.id,
              campanaId,
            );

            resultados.push({
              id: destinatario.id,
              idc: destinatario.idc,
              cliente: destinatario.cliente,
              telefonoDestino: destinatario.telefono_destino,
              estado: "ENVIADO",
              detalle: resultado.detalle,
              duracionMs: resultado.duracionMs,
              intentos: intento,
            });

            if (intento === 2) {
              reintentados++;
            }

            break;
          }

          const reintentable = errorEsReintentable(resultado.detalle);

          if (reintentable && intento === 1) {
            reintentados++;

            await new Promise((resolve) => setTimeout(resolve, 1500));

            continue;
          }

          break;
        } catch (errorDestinatario) {
          ultimoTiempo = Date.now() - inicio;

          ultimoDetalle =
            errorDestinatario instanceof Error
              ? errorDestinatario.message
              : "Error inesperado durante el envío.";

          if (intento === 1 && errorEsReintentable(ultimoDetalle)) {
            reintentados++;

            await new Promise((resolve) => setTimeout(resolve, 1500));

            continue;
          }

          break;
        }
      }

      if (!enviado) {
        db.prepare(
          `
          UPDATE whatsapp_campana_destinatarios
          SET
            estado = 'ERROR',
            error = ?,
            fecha_procesamiento = ?,
            mensaje = ?,
            duracion_ms = ?
          WHERE id = ?
            AND campana_id = ?
            AND estado = 'PREPARADO'
        `,
        ).run(
          ultimoDetalle || "No se pudo enviar el mensaje.",
          new Date().toISOString(),
          mensaje,
          ultimoTiempo,
          destinatario.id,
          campanaId,
        );

        resultados.push({
          id: destinatario.id,
          idc: destinatario.idc,
          cliente: destinatario.cliente,
          telefonoDestino: destinatario.telefono_destino,
          estado: "ERROR",
          detalle: ultimoDetalle || "No se pudo enviar el mensaje.",
          duracionMs: ultimoTiempo,
          intentos: 2,
        });
      }

      actualizarHeartbeat(campanaId);
    }
  } finally {
    clearInterval(heartbeat);
  }

  const final = sincronizarFinal(campanaId, false);

  const temporal = esSesionWhatsappTemporal(campana.numero_salida);

  let limpiezaTemporal: string | null = null;

  if (
    temporal &&
    final.conteo.preparados === 0 &&
    final.conteo.pendientes === 0
  ) {
    try {
      await cerrarYEliminarWhatsappTemporal(campana.numero_salida);

      limpiezaTemporal = "Sesión temporal cerrada y eliminada automáticamente.";
    } catch (errorLimpieza) {
      console.error("Error limpiando sesión temporal:", errorLimpieza);

      limpiezaTemporal =
        "La campaña terminó, pero no se pudo limpiar automáticamente la sesión temporal.";
    }
  }

  return {
    ok: final.estado === "ENVIADA",
    campanaId,
    estado: final.estado,
    total: final.conteo.total,
    enviados: final.conteo.enviados,
    fallidos:
      final.conteo.errores +
      final.conteo.sinTelefono +
      final.conteo.preparados +
      final.conteo.pendientes,
    reintentados,
    reanudado: modo === "REANUDAR",
    resultados,
    limpiezaTemporal,
  };
}

export async function enviarCampanaNueva(campanaId: number) {
  return procesarCampana(campanaId, "NUEVA");
}

export async function reanudarCampana(campanaId: number) {
  return procesarCampana(campanaId, "REANUDAR");
}

export function obtenerEstadoReanudacion(campanaId: number) {
  inicializarMigracion6138();

  const campana = obtenerCampana(campanaId);

  if (!campana) {
    return {
      existe: false,
      reanudable: false,
      motivo: "La campaña no existe.",
    };
  }

  const conteo = contarEstados(campanaId);

  const reanudable =
    conteo.preparados > 0 &&
    (campana.estado === "ERROR" ||
      campana.estado === "ENVIADA_CON_ERRORES" ||
      esCampanaObsoleta(campana));

  return {
    existe: true,
    reanudable,
    estado: campana.estado,
    numeroSalida: campana.numero_salida,
    total: conteo.total,
    enviados: conteo.enviados,
    pendientes: conteo.preparados + conteo.pendientes,
    ultimaActividad: campana.ultima_actividad,
  };
}
