// app/api/whatsapp/enviar/route.ts
//
// Endpoint REAL de envío de campañas de WhatsApp.

import { NextRequest, NextResponse } from "next/server";

import {
  consultarFilas,
  consultarUno,
  ejecutar,
  conTransaccion,
} from "@/lib/postgres";

import { leerSesionActual, type DatosSesion } from "@/lib/auth";

import { enviarUnMensajeWhatsapp, identificadorEnvioWhatsapp } from "@/lib/whatsapp/envio";
import { autorizarNumeroVinculacion, actualizarPermisoEnvioWhatsapp } from "@/lib/whatsapp/acceso-vinculacion";

import {
  iniciarWhatsappParaEnvio,
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
  sesion: DatosSesion,
  idEnvio: string,
): Promise<ResultadoEnvioConReintento> {
  let reintentos = 0;

  let duracionTotal = 0;

  let ultimoDetalle = "No se pudo enviar el mensaje.";

  while (true) {
    const inicio = Date.now();

    try {
      const actorActual = await actualizarPermisoEnvioWhatsapp(sesion, numeroSalida);
      const resultado = await enviarUnMensajeWhatsapp(
        numeroSalida,
        telefono,
        mensaje,
        actorActual,
        idEnvio,
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

async function contarEstadosCampana(campanaId: number): Promise<ConteoFinal> {
  const fila = await consultarUno<ConteoFinal>(
    `
        SELECT
          COUNT(*)::int
            AS total,

          COUNT(*) FILTER (
            WHERE estado = 'PREPARADO'
          )::int
            AS preparados,

          COUNT(*) FILTER (
            WHERE estado = 'ENVIADO'
          )::int
            AS enviados,

          COUNT(*) FILTER (
            WHERE estado = 'ERROR'
          )::int
            AS errores,

          COUNT(*) FILTER (
            WHERE estado = 'SIN_TELEFONO'
          )::int
            AS "sinTelefono",

          COUNT(*) FILTER (
            WHERE estado NOT IN (
              'PREPARADO',
              'ENVIADO',
              'ERROR',
              'SIN_TELEFONO'
            )
          )::int
            AS pendientes

        FROM
          whatsapp_campana_destinatarios

        WHERE
          campana_id = $1
      `,
    [campanaId],
  );

  return {
    total: fila?.total ?? 0,

    preparados: fila?.preparados ?? 0,

    enviados: fila?.enviados ?? 0,

    errores: fila?.errores ?? 0,

    sinTelefono: fila?.sinTelefono ?? 0,

    pendientes: fila?.pendientes ?? 0,
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

async function sincronizarCampanaConBD(
  campanaId: number,
  forzadamenteError = false,
): Promise<{
  estado: EstadoFinalCampana;
  conteo: ConteoFinal;
}> {
  const conteo = await contarEstadosCampana(campanaId);

  const estado = determinarEstadoFinal(conteo, forzadamenteError);

  await ejecutar(
    `
      UPDATE
        whatsapp_campanas

      SET
        total_preparados = $1,
        total_fallidos = $2,
        total_enviados = $3,
        estado = $4

      WHERE
        id = $5
    `,
    [
      conteo.total - conteo.sinTelefono,

      conteo.errores + conteo.sinTelefono,

      conteo.enviados,

      estado,

      campanaId,
    ],
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

  if (sesion.debeCambiarContrasena || !ROLES_PERMITIDOS.includes(sesion.rol)) {
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
    const campana = await consultarUno<Campana>(
      `
          SELECT
            id::int
              AS id,

            numero_salida,
            estado,

            total_seleccionados::int
              AS total_seleccionados,

            total_preparados::int
              AS total_preparados,

            total_sin_telefono::int
              AS total_sin_telefono,

            total_fallidos::int
              AS total_fallidos,

            total_enviados::int
              AS total_enviados

          FROM
            whatsapp_campanas

          WHERE
            id = $1

          LIMIT 1
        `,
      [campanaId],
    );

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

    await autorizarNumeroVinculacion(sesion, campana.numero_salida);
    const sesionTemporal = await esSesionWhatsappTemporal(campana.numero_salida, sesion);

    const estadoWhatsapp = await iniciarWhatsappParaEnvio(
      campana.numero_salida,
      sesionTemporal,
      20_000,
      sesion,
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

    const destinatarios = await consultarFilas<Destinatario>(
      `
          SELECT
            id::int
              AS id,

            idc,
            cliente,
            telefono_destino,
            mensaje,
            estado

          FROM
            whatsapp_campana_destinatarios

          WHERE
            campana_id = $1

            AND estado =
              'PREPARADO'

          ORDER BY
            id ASC
        `,
      [campanaId],
    );

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

    const reclamada = await conTransaccion(async () => {
      const lock = await consultarUno<{
        bloqueado: boolean;
      }>(
        `
                SELECT
                  pg_try_advisory_xact_lock(
                    hashtext($1)
                  )
                    AS bloqueado
              `,
        [campana.numero_salida],
      );

      if (!lock?.bloqueado) {
        return false;
      }

      const resultado = await consultarUno<{
        id: number;
      }>(
        `
                UPDATE
                  whatsapp_campanas
                    AS actual

                SET
                  estado =
                    'ENVIANDO'

                WHERE
                  actual.id = $1

                  AND actual.estado
                    IN (
                      'PREPARADA',
                      'PREPARADA_CON_ERRORES'
                    )

                  AND NOT EXISTS (
                    SELECT
                      1

                    FROM
                      whatsapp_campanas
                        AS otra

                    WHERE
                      otra.id <>
                        actual.id

                      AND otra.numero_salida =
                        actual.numero_salida

                      AND otra.estado =
                        'ENVIANDO'
                  )

                RETURNING
                  actual.id::int
                    AS id
              `,
        [campanaId],
      );

      return Boolean(resultado);
    });

    if (!reclamada) {
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

        await ejecutar(
          `
            UPDATE
              whatsapp_campana_destinatarios

            SET
              estado = 'ERROR',

              error = $1,

              fecha_procesamiento =
                $2

            WHERE
              id = $3

              AND campana_id =
                $4
          `,
          ["Falta teléfono o mensaje.", fecha, destinatario.id, campanaId],
        );

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
        sesion,
        identificadorEnvioWhatsapp(campanaId, destinatario.id),
      );

      const detalleFinal =
        resultado.reintentos > 0
          ? `${resultado.detalle} (reintentos: ${resultado.reintentos})`
          : resultado.detalle;

      if (resultado.ok) {
        enviados++;

        await ejecutar(
          `
            UPDATE
              whatsapp_campana_destinatarios

            SET
              estado =
                'ENVIADO',

              error =
                NULL,

              fecha_procesamiento =
                $1,

              mensaje =
                $2,

              duracion_ms =
                $3

            WHERE
              id =
                $4

              AND campana_id =
                $5
          `,
          [
            new Date().toISOString(),

            mensaje,

            resultado.duracionMs,

            destinatario.id,

            campanaId,
          ],
        );
      } else {
        fallidos++;

        await ejecutar(
          `
            UPDATE
              whatsapp_campana_destinatarios

            SET
              estado =
                'ERROR',

              error =
                $1,

              fecha_procesamiento =
                $2,

              mensaje =
                $3,

              duracion_ms =
                $4

            WHERE
              id =
                $5

              AND campana_id =
                $6
          `,
          [
            detalleFinal,

            new Date().toISOString(),

            mensaje,

            resultado.duracionMs,

            destinatario.id,

            campanaId,
          ],
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

    const sincronizacion = await sincronizarCampanaConBD(campanaId);

    const {
      estado: estadoFinal,

      conteo,
    } = sincronizacion;

    if (conteo.preparados > 0 || conteo.pendientes > 0) {
      await ejecutar(
        `
          UPDATE
            whatsapp_campanas

          SET
            total_enviados =
              $1,

            total_fallidos =
              $2,

            estado =
              'ENVIADA_CON_ERRORES'

          WHERE
            id =
              $3
        `,
        [
          conteo.enviados,

          conteo.errores +
          conteo.sinTelefono +
          conteo.preparados +
          conteo.pendientes,

          campanaId,
        ],
      );
    }

    const estadoCampanaReal =
      conteo.preparados > 0 || conteo.pendientes > 0
        ? "ENVIADA_CON_ERRORES"
        : estadoFinal;

    const temporal = await esSesionWhatsappTemporal(campana.numero_salida, sesion);

    let limpiezaTemporal: string | null = null;

    if (temporal) {
      try {
        await cerrarYEliminarWhatsappTemporal(campana.numero_salida, sesion);

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
      const sincronizacion = await sincronizarCampanaConBD(campanaId, true);

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
