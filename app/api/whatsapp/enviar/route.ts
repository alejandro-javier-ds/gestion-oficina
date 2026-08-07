// app/api/whatsapp/enviar/route.ts
//
// Endpoint REAL de envío de campañas de WhatsApp.

import { NextRequest, NextResponse } from "next/server";

import db from "@/lib/db";

import { leerSesionActual } from "@/lib/auth";

import { enviarUnMensajeWhatsapp } from "@/lib/whatsapp/envio";

import {
  iniciarWhatsappParaEnvio,
  obtenerEstadoWhatsapp,
  esSesionWhatsappTemporal,
  cerrarYEliminarWhatsappTemporal,
} from "@/lib/whatsapp/playwright";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor"];

const MAX_REINTENTOS_AUTOMATICOS = 1;
const ESPERA_ENTRE_REINTENTOS_MS = 1500;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function esErrorReintentable(detalle: string): boolean {
  const texto = detalle.toLowerCase();

  const permanentes = [
    "número inválido",
    "numero inválido",
    "numero invalido",
    "número no válido",
    "numero no valido",
    "no existe",
    "destinatario inexistente",
    "no tiene whatsapp",
    "no tiene whatsapp",
    "falta teléfono",
    "falta telefono",
    "sin teléfono",
    "sin telefono",
  ];

  if (permanentes.some((frase) => texto.includes(frase))) {
    return false;
  }

  const transitorios = [
    "timeout",
    "timed out",
    "target page",
    "target closed",
    "page has been closed",
    "context has been closed",
    "browser has been closed",
    "navigation",
    "net::",
    "econn",
    "socket",
    "connection",
    "conexión",
    "conexion",
    "desconectado",
    "disconnect",
    "network",
    "networkerror",
    "temporarily",
    "temporalmente",
  ];

  return transitorios.some((frase) => texto.includes(frase));
}

type ResultadoEnvioConReintento = {
  ok: boolean;
  estado: "ENVIADO" | "ERROR";
  detalle: string;
  duracionMs: number;
  reintentos: number;
};

async function enviarConReintento(
  numeroSalida: string,
  telefono: string,
  mensaje: string,
): Promise<ResultadoEnvioConReintento> {
  let reintentos = 0;
  let duracionTotal = 0;
  let ultimoDetalle = "No se pudo enviar el mensaje.";

  while (true) {
    const inicio = Date.now();

    try {
      const resultado = await enviarUnMensajeWhatsapp(
        numeroSalida,
        telefono,
        mensaje,
      );

      const duracionReportada = Number(resultado.duracionMs ?? 0);
      const duracionReal = Date.now() - inicio;
      duracionTotal += Math.max(duracionReportada, duracionReal, 0);

      if (resultado.ok) {
        return {
          ok: true,
          estado: "ENVIADO",
          detalle:
            reintentos > 0
              ? `Enviado después de ${reintentos} reintento.`
              : resultado.detalle,
          duracionMs: duracionTotal,
          reintentos,
        };
      }

      ultimoDetalle = resultado.detalle || "No se pudo enviar el mensaje.";

      if (
        reintentos >= MAX_REINTENTOS_AUTOMATICOS ||
        !esErrorReintentable(ultimoDetalle)
      ) {
        return {
          ok: false,
          estado: "ERROR",
          detalle: ultimoDetalle,
          duracionMs: duracionTotal,
          reintentos,
        };
      }
    } catch (error) {
      const duracionReal = Date.now() - inicio;
      duracionTotal += Math.max(duracionReal, 0);

      ultimoDetalle =
        error instanceof Error
          ? error.message
          : "Error inesperado durante el envío.";

      if (
        reintentos >= MAX_REINTENTOS_AUTOMATICOS ||
        !esErrorReintentable(ultimoDetalle)
      ) {
        return {
          ok: false,
          estado: "ERROR",
          detalle: ultimoDetalle,
          duracionMs: duracionTotal,
          reintentos,
        };
      }
    }

    reintentos++;

    await esperar(ESPERA_ENTRE_REINTENTOS_MS);
  }
}

type Campana = {
  id: number;
  numero_salida: string;
  estado: string;
  total_seleccionados: number;
  total_preparados: number;
  total_sin_telefono: number;
  total_fallidos: number;
  total_enviados: number;
};

type Destinatario = {
  id: number;
  idc: string;
  cliente: string | null;
  telefono_destino: string | null;
  mensaje: string | null;
  estado: string;
};

type EstadoFinalCampana = "ENVIADA" | "ENVIADA_CON_ERRORES" | "ERROR";

type ConteoFinal = {
  total: number;
  preparados: number;
  enviados: number;
  errores: number;
  sinTelefono: number;
  pendientes: number;
};

function contarEstadosCampana(campanaId: number): ConteoFinal {
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

function determinarEstadoFinal(
  conteo: ConteoFinal,
  forzadamenteError = false,
): EstadoFinalCampana {
  if (conteo.enviados === conteo.total && conteo.total > 0) {
    return "ENVIADA";
  }

  if (conteo.enviados > 0) {
    return "ENVIADA_CON_ERRORES";
  }

  if (conteo.total > 0 && conteo.errores > 0) {
    return "ERROR";
  }

  if (forzadamenteError) {
    return "ERROR";
  }

  return "ERROR";
}

function sincronizarCampanaConBD(
  campanaId: number,
  forzadamenteError = false,
): {
  estado: EstadoFinalCampana;
  conteo: ConteoFinal;
} {
  const conteo = contarEstadosCampana(campanaId);

  const estado = determinarEstadoFinal(conteo, forzadamenteError);

  db.prepare(
    `
    UPDATE whatsapp_campanas
    SET
      total_preparados = ?,
      total_fallidos = ?,
      total_enviados = ?,
      estado = ?
    WHERE id = ?
  `,
  ).run(
    conteo.total - conteo.sinTelefono,
    conteo.errores + conteo.sinTelefono,
    conteo.enviados,
    estado,
    campanaId,
  );

  return {
    estado,
    conteo,
  };
}

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "No tienes permiso para enviar campañas de WhatsApp.",
      },
      {
        status: 403,
      },
    );
  }

  let body: {
    campanaId?: unknown;
  } | null = null;

  try {
    body = (await request.json()) as {
      campanaId?: unknown;
    };
  } catch {
    return NextResponse.json(
      {
        error: "El cuerpo de la solicitud no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  const campanaId = Number(body?.campanaId);

  if (!Number.isInteger(campanaId) || campanaId <= 0) {
    return NextResponse.json(
      {
        error: "El ID de campaña no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const campana = db
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
          total_enviados
        FROM whatsapp_campanas
        WHERE id = ?
        LIMIT 1
      `,
      )
      .get(campanaId) as Campana | undefined;

    if (!campana) {
      return NextResponse.json(
        {
          error: "La campaña no existe.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      campana.estado !== "PREPARADA" &&
      campana.estado !== "PREPARADA_CON_ERRORES"
    ) {
      return NextResponse.json(
        {
          error: `La campaña no está disponible para envío. Estado actual: ${campana.estado}.`,
        },
        {
          status: 409,
        },
      );
    }

    if (campana.total_sin_telefono > 0 || campana.total_fallidos > 0) {
      return NextResponse.json(
        {
          error:
            "La campaña tiene destinatarios con errores. Corrige la campaña antes de enviarla.",
        },
        {
          status: 409,
        },
      );
    }

    const sesionTemporal = esSesionWhatsappTemporal(campana.numero_salida);

    const estadoWhatsapp = await iniciarWhatsappParaEnvio(
      campana.numero_salida,
      sesionTemporal,
    );

    if (!estadoWhatsapp.conectado) {
      return NextResponse.json(
        {
          error: `El número de salida ${campana.numero_salida} no está conectado a WhatsApp Web.`,
        },
        {
          status: 409,
        },
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
      return NextResponse.json(
        {
          error: "La campaña no tiene destinatarios preparados para enviar.",
        },
        {
          status: 409,
        },
      );
    }

    const reclamada = db
      .prepare(
        `
      UPDATE whatsapp_campanas
      SET estado = 'ENVIANDO'
      WHERE id = ?
        AND estado IN ('PREPARADA', 'PREPARADA_CON_ERRORES')
        AND NOT EXISTS (
          SELECT 1
          FROM whatsapp_campanas otra
          WHERE otra.id <> whatsapp_campanas.id
            AND otra.numero_salida = whatsapp_campanas.numero_salida
            AND otra.estado = 'ENVIANDO'
        )
    `,
      )
      .run(campanaId);

    if (reclamada.changes !== 1) {
      return NextResponse.json(
        {
          error: `El número de salida ${campana.numero_salida} ya está ocupado por otra campaña en ejecución.`,
        },
        {
          status: 409,
        },
      );
    }

    let enviados = 0;
    let fallidos = 0;

    const resultados: Array<{
      id: number;
      idc: string;
      cliente: string | null;
      telefonoDestino: string | null;
      estado: "ENVIADO" | "ERROR";
      detalle: string;
      duracionMs: number;
    }> = [];

    for (const destinatario of destinatarios) {
      const fecha = new Date().toISOString();

      const telefono = destinatario.telefono_destino ?? "";

      const mensaje = destinatario.mensaje ?? "";

      if (!telefono || !mensaje.trim()) {
        fallidos++;

        db.prepare(
          `
          UPDATE whatsapp_campana_destinatarios
          SET
            estado = 'ERROR',
            error = ?,
            fecha_procesamiento = ?
          WHERE id = ?
            AND campana_id = ?
        `,
        ).run("Falta teléfono o mensaje.", fecha, destinatario.id, campanaId);

        resultados.push({
          id: destinatario.id,
          idc: destinatario.idc,
          cliente: destinatario.cliente,
          telefonoDestino: destinatario.telefono_destino,
          estado: "ERROR",
          detalle: "Falta teléfono o mensaje.",
          duracionMs: 0,
        });

        continue;
      }

      const resultado = await enviarConReintento(
        campana.numero_salida,
        telefono,
        mensaje,
      );

      const detalleFinal =
        resultado.reintentos > 0
          ? `${resultado.detalle} (reintentos: ${resultado.reintentos})`
          : resultado.detalle;

      if (resultado.ok) {
        enviados++;

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
        `,
        ).run(
          new Date().toISOString(),
          mensaje,
          resultado.duracionMs,
          destinatario.id,
          campanaId,
        );
      } else {
        fallidos++;

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
        `,
        ).run(
          detalleFinal,
          new Date().toISOString(),
          mensaje,
          resultado.duracionMs,
          destinatario.id,
          campanaId,
        );
      }

      resultados.push({
        id: destinatario.id,
        idc: destinatario.idc,
        cliente: destinatario.cliente,
        telefonoDestino: destinatario.telefono_destino,
        estado: resultado.estado,
        detalle: detalleFinal,
        duracionMs: resultado.duracionMs,
      });
    }

    const sincronizacion = sincronizarCampanaConBD(campanaId);

    const { estado: estadoFinal, conteo } = sincronizacion;

    if (conteo.preparados > 0 || conteo.pendientes > 0) {
      db.prepare(
        `
        UPDATE whatsapp_campanas
        SET
          total_enviados = ?,
          total_fallidos = ?,
          estado = 'ENVIADA_CON_ERRORES'
        WHERE id = ?
      `,
      ).run(
        conteo.enviados,
        conteo.errores +
        conteo.sinTelefono +
        conteo.preparados +
        conteo.pendientes,
        campanaId,
      );
    }

    const estadoCampanaReal =
      conteo.preparados > 0 || conteo.pendientes > 0
        ? "ENVIADA_CON_ERRORES"
        : estadoFinal;

    const temporal = esSesionWhatsappTemporal(campana.numero_salida);

    let limpiezaTemporal: string | null = null;

    if (temporal) {
      try {
        await cerrarYEliminarWhatsappTemporal(campana.numero_salida);

        limpiezaTemporal =
          "Sesión temporal cerrada y eliminada automáticamente.";
      } catch (errorLimpieza) {
        console.error(
          "Error limpiando sesión temporal después del envío:",
          errorLimpieza,
        );

        limpiezaTemporal =
          "La campaña terminó, pero no se pudo limpiar automáticamente la sesión temporal.";
      }
    }

    return NextResponse.json({
      ok: estadoCampanaReal === "ENVIADA",
      campanaId,
      estado: estadoCampanaReal,
      total: conteo.total,
      enviados: conteo.enviados,
      fallidos:
        conteo.errores +
        conteo.sinTelefono +
        conteo.preparados +
        conteo.pendientes,
      resultados,
      limpiezaTemporal,
    });
  } catch (error) {
    console.error("Error enviando campaña WhatsApp:", error);

    let estadoRecuperado: EstadoFinalCampana | null = null;
    let conteoRecuperado: ConteoFinal | null = null;

    try {
      const sincronizacion = sincronizarCampanaConBD(campanaId, true);

      estadoRecuperado = sincronizacion.estado;

      conteoRecuperado = sincronizacion.conteo;
    } catch (errorSincronizacion) {
      console.error(
        "No se pudo sincronizar el estado final de la campaña:",
        errorSincronizacion,
      );
    }

    return NextResponse.json(
      {
        ok: false,
        estado: estadoRecuperado ?? "ERROR",
        campanaId,
        enviados: conteoRecuperado?.enviados ?? 0,
        fallidos: conteoRecuperado
          ? conteoRecuperado.errores +
          conteoRecuperado.sinTelefono +
          conteoRecuperado.preparados +
          conteoRecuperado.pendientes
          : 0,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar la campaña.",
      },
      {
        status: 500,
      },
    );
  }
}
