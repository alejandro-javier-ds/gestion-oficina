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

import {
  enviarUnMensajeWhatsapp,
  identificadorEnvioWhatsapp,
} from "@/lib/whatsapp/envio";
import {
  autorizarNumeroVinculacion,
  actualizarPermisoEnvioWhatsapp,
} from "@/lib/whatsapp/acceso-vinculacion";

import {
  iniciarWhatsappParaEnvio,
  esSesionWhatsappTemporal,
  cerrarYEliminarWhatsappTemporal,
  iniciarReservaCampanaWhatsapp,
  finalizarReservaCampanaWhatsapp,
} from "@/lib/whatsapp/playwright";

import {
  DESTINOS_ACTUALES_SQL,
  validarDestinosAutorizados,
  ErrorCampanaWhatsapp,
  validarConfirmacionesEnvioWhatsapp,
  versionSeleccionWhatsapp,
} from "@/lib/whatsapp/campanas";
import { normalizarCelularWhatsapp } from "@/lib/whatsapp/seguimiento";
import {
  determinarEstadoFinalCampana,
  type ConteoFinalCampana,
  type EstadoFinalCampana,
} from "@/lib/whatsapp/estado-campana";
export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor"];

type ResultadoEnvioCampana = {
  ok: boolean;

  estado: "ENVIADO" | "ERROR" | "INCIERTO";

  detalle: string;

  duracionMs: number;

};

async function enviarUnicoIntento(
  numeroSalida: string,
  telefono: string,
  mensaje: string,
  sesion: DatosSesion,
  idEnvio: string,
  idc: string,
  gestor: string | null,
  tipoTelefono: string,
  tenor: string | null,
  leaseId: string | null,
): Promise<ResultadoEnvioCampana> {
  const inicio = Date.now();
  let envioInvocado = false;
  try {
    const actorActual = await actualizarPermisoEnvioWhatsapp(
      sesion,
      numeroSalida,
    );
    await validarDestinosAutorizados(actorActual, [
      {
        idc,
        cliente: "",
        gestor,
        telefonoDestino: telefono,
        tipoTelefono,
        mensaje,
        estado: "PREPARADO",
        error: null,
        tenor,
      },
    ]);
    envioInvocado = true;
    const resultado = await enviarUnMensajeWhatsapp(
      numeroSalida,
      telefono,
      mensaje,
      leaseId ? { ...actorActual, campanaLeaseId: leaseId } : actorActual,
      idEnvio,
      leaseId,
    );
    return {
      ok: resultado.estado === "ENVIADO" && resultado.ok,
      estado: resultado.estado,
      detalle: resultado.detalle,
      duracionMs: Math.max(Number(resultado.duracionMs ?? 0), Date.now() - inicio),
    };
  } catch (error) {
    return {
      ok: false,
      estado: envioInvocado ? "INCIERTO" : "ERROR",
      detalle:
        error instanceof Error
          ? error.message
          : "No se pudo completar la operación de envío.",
      duracionMs: Date.now() - inicio,
    };
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

  gestor: string | null;

  telefono_destino: string | null;

  tipo_telefono: string | null;

  mensaje: string | null;

  tenor: string | null;

  estado: string;
};

async function contarEstadosCampana(campanaId: number): Promise<ConteoFinalCampana> {
  const fila = await consultarUno<ConteoFinalCampana>(
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
            WHERE estado = 'INCIERTO'
          )::int
            AS inciertos,

          COUNT(*) FILTER (
            WHERE estado = 'SIN_TELEFONO'
          )::int
            AS "sinTelefono",

          COUNT(*) FILTER (
            WHERE estado NOT IN (
              'PREPARADO',
              'ENVIADO',
              'ERROR',
              'SIN_TELEFONO',
              'INCIERTO',
              'EXCLUIDO'
            )
          )::int
            AS pendientes

        FROM (${DESTINOS_ACTUALES_SQL}) AS actuales
      `,
    [campanaId],
  );

  return {
    total: fila?.total ?? 0,

    preparados: fila?.preparados ?? 0,

    enviados: fila?.enviados ?? 0,

    errores: fila?.errores ?? 0,

    inciertos: fila?.inciertos ?? 0,

    sinTelefono: fila?.sinTelefono ?? 0,

    pendientes: fila?.pendientes ?? 0,
  };
}

async function sincronizarCampanaConBD(
  campanaId: number,
): Promise<{
  estado: EstadoFinalCampana;
  conteo: ConteoFinalCampana;
}> {
  const conteo = await contarEstadosCampana(campanaId);

  const estado = determinarEstadoFinalCampana(conteo);

  await ejecutar(
    `
      UPDATE
        whatsapp_campanas

      SET
        total_preparados = $1,
        total_sin_telefono = $2,
        total_fallidos = $3,
        total_enviados = $4,
        estado = $5

      WHERE
        id = $6
    `,
    [
      conteo.preparados,

      conteo.sinTelefono,

      conteo.errores,

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
    versionSeleccion?: unknown;
    seleccionExplicita?: unknown;
    confirmarSeguimientos?: unknown;
    confirmarReintentos?: unknown;
    confirmarResultadosRevisados?: unknown;
  } | null = null;

  try {
    body = (await request.json()) as {
      campanaId?: unknown;
      versionSeleccion?: unknown;
      seleccionExplicita?: unknown;
      confirmarSeguimientos?: unknown;
      confirmarReintentos?: unknown;
      confirmarResultadosRevisados?: unknown;
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

  let leaseId: string | null = null;
  try {
    leaseId = await iniciarReservaCampanaWhatsapp(campanaId, sesion);
  } catch {
    return NextResponse.json(
      { error: "WhatsApp está ocupado o entrando en mantenimiento. No se inició la campaña." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const actorCampana = leaseId ? { ...sesion, campanaLeaseId: leaseId } : sesion;

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

    await autorizarNumeroVinculacion(sesion, campana.numero_salida);
    const sesionTemporal = await esSesionWhatsappTemporal(
      campana.numero_salida,
      actorCampana,
    );

    const estadoWhatsapp = await iniciarWhatsappParaEnvio(
      campana.numero_salida,
      sesionTemporal,
      20_000,
      actorCampana,
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
        return null;
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

      if (!resultado) return null;
      if (
        body?.seleccionExplicita !== true ||
        body.versionSeleccion !== (await versionSeleccionWhatsapp(campanaId))
      )
        throw new ErrorCampanaWhatsapp(
          "La selección cambió o no fue revisada. Actualiza la campaña antes de enviar.",
          409,
        );
      const pendientes = await consultarFilas<Destinatario>(
        `SELECT id::int, idc, cliente, gestor, telefono_destino, tipo_telefono, mensaje, tenor, estado FROM (${DESTINOS_ACTUALES_SQL}) AS actuales WHERE estado = 'PREPARADO' ORDER BY id`,
        [campanaId],
      );
      if (!pendientes.length)
        throw new ErrorCampanaWhatsapp(
          "La campaña no tiene destinatarios preparados para enviar.",
          409,
        );
      await validarConfirmacionesEnvioWhatsapp(
        campanaId,
        pendientes,
        body ?? {},
      );
      await validarDestinosAutorizados(
        sesion,
        pendientes.map((d) => ({
          idc: d.idc,
          cliente: d.cliente ?? "",
          gestor: d.gestor,
          telefonoDestino: normalizarCelularWhatsapp(d.telefono_destino),
          tipoTelefono: d.tipo_telefono ?? "celular",
          mensaje: d.mensaje,
          estado: "PREPARADO",
          error: null,
          tenor: d.tenor,
        })),
      );
      return pendientes;
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

    const destinatarios = reclamada;
    const resultados: Array<{
      id: number;

      idc: string;

      cliente: string | null;

      telefonoDestino: string | null;

      estado: "ENVIADO" | "ERROR" | "INCIERTO";

      detalle: string;

      duracionMs: number;
    }> = [];

    for (const destinatario of destinatarios) {
      const fecha = new Date().toISOString();

      const telefono = normalizarCelularWhatsapp(destinatario.telefono_destino);

      const mensaje = destinatario.mensaje ?? "";

      if (!telefono || !mensaje.trim()) {
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

      const iniciado = await consultarUno<{ id: number }>(
        "UPDATE whatsapp_campana_destinatarios SET estado = 'ENVIANDO', fecha_procesamiento = $1 WHERE id = $2 AND campana_id = $3 AND estado = 'PREPARADO' RETURNING id::int AS id",
        [fecha, destinatario.id, campanaId],
      );
      if (!iniciado) continue;
      const resultado = await enviarUnicoIntento(
        campana.numero_salida,
        telefono,
        mensaje,
        sesion,
        identificadorEnvioWhatsapp(campanaId, destinatario.id),
        destinatario.idc,
        destinatario.gestor,
        destinatario.tipo_telefono ?? "celular",
        destinatario.tenor,
        leaseId,
      );

      const detalleFinal = resultado.detalle;

      if (resultado.ok) {
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

              AND estado = 'ENVIANDO'
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
        await ejecutar(
          `
            UPDATE
              whatsapp_campana_destinatarios

            SET
              estado = $7,

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

              AND estado = 'ENVIANDO'
          `,
          [
            detalleFinal,

            new Date().toISOString(),

            mensaje,

            resultado.duracionMs,

            destinatario.id,

            campanaId,

            resultado.estado,
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

    const estadoCampanaReal = estadoFinal;

    const temporal = await esSesionWhatsappTemporal(
      campana.numero_salida,
      actorCampana,
    );

    let limpiezaTemporal: string | null = null;

    if (temporal) {
      try {
        await cerrarYEliminarWhatsappTemporal(campana.numero_salida, actorCampana);

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

      procesados:
        conteo.enviados +
        conteo.errores +
        conteo.sinTelefono +
        conteo.inciertos,

      enviados: conteo.enviados,

      fallidos: conteo.errores + conteo.sinTelefono,

      sinTelefono: conteo.sinTelefono,

      preparados: conteo.preparados,

      inciertos: conteo.inciertos,

      pendientes: conteo.preparados + conteo.pendientes,

      resultados,

      limpiezaTemporal,
    });
  } catch (error) {
    if (error instanceof ErrorCampanaWhatsapp)
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    console.error("Error enviando campaña WhatsApp:", error);

    try {
      await ejecutar(
        "UPDATE whatsapp_campana_destinatarios SET estado = 'INCIERTO', error = COALESCE(error, 'La operación se interrumpió y requiere verificación manual.'), fecha_procesamiento = COALESCE(fecha_procesamiento, $1) WHERE campana_id = $2 AND estado = 'ENVIANDO'",
        [new Date().toISOString(), campanaId],
      );
    } catch (errorIncierto) {
      console.error(
        "No se pudo marcar como incierto el destinatario interrumpido:",
        errorIncierto,
      );
    }

    let estadoRecuperado: EstadoFinalCampana | null = null;

    let conteoRecuperado: ConteoFinalCampana | null = null;

    try {
      const sincronizacion = await sincronizarCampanaConBD(campanaId);

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

        procesados: conteoRecuperado
          ? conteoRecuperado.enviados +
            conteoRecuperado.errores +
            conteoRecuperado.sinTelefono +
            conteoRecuperado.inciertos
          : 0,

        fallidos: conteoRecuperado
          ? conteoRecuperado.errores + conteoRecuperado.sinTelefono
          : 0,

        sinTelefono: conteoRecuperado?.sinTelefono ?? 0,

        preparados: conteoRecuperado?.preparados ?? 0,

        inciertos: conteoRecuperado?.inciertos ?? 0,

        pendientes: conteoRecuperado
          ? conteoRecuperado.preparados + conteoRecuperado.pendientes
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
  } finally {
    if (leaseId) {
      try {
        await finalizarReservaCampanaWhatsapp(campanaId, leaseId, actorCampana);
      } catch {
        console.error("No se pudo liberar la reserva de mantenimiento de WhatsApp.");
      }
    }
  }
}
