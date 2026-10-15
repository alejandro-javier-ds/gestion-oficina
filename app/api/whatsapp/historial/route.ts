// app/api/whatsapp/historial/route.ts
//
// Historial de campañas de WhatsApp Masivo.
//
// Crea y consulta campañas y sus destinatarios.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";
import { ErrorPreparacionWhatsapp } from "@/lib/whatsapp/preparacion";

import {
  guardarSeleccionCampanaWhatsapp,
  validarAccesoCampanas,
  obtenerCampanaAutorizada,
  ErrorCampanaWhatsapp,
  CABECERAS_CAMPANAS,
} from "@/lib/whatsapp/campanas";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

type CampanaWhatsapp = {
  id: number;
  fecha_creacion: string;
  usuario_creador: string | null;
  campana: string;
  gestor: string | null;
  desde: string;
  hasta: string;
  numero_salida: string;
  total_seleccionados: number;
  total_preparados: number;
  total_sin_telefono: number;
  total_fallidos: number;
  total_enviados: number;
  total_inciertos: number;
  estado: string;
};

type DestinatarioWhatsapp = {
  id: number;
  idc: string;
  cliente: string | null;
  gestor: string | null;
  telefono_destino: string | null;
  tipo_telefono: string | null;
  estado: string;
  error: string | null;
  fecha_procesamiento: string | null;
  mensaje: string | null;
  duracion_ms: number | null;
  tenor: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const sesion = validarAccesoCampanas(await leerSesionActual());
    const resultado = await guardarSeleccionCampanaWhatsapp(
      sesion,
      await request.json(),
    );
    return NextResponse.json(resultado, {
      status: 201,
      headers: CABECERAS_CAMPANAS,
    });
  } catch (error) {
    const status =
      error instanceof ErrorCampanaWhatsapp
        ? error.status
        : error instanceof ErrorPreparacionWhatsapp ||
            error instanceof SyntaxError
          ? 400
          : 500;
    return NextResponse.json(
      {
        error:
          error instanceof ErrorCampanaWhatsapp ||
          error instanceof ErrorPreparacionWhatsapp
            ? error.message
            : status === 400
              ? "El cuerpo de la solicitud no es válido."
              : "No se pudo guardar la campaña.",
      },
      { status, headers: CABECERAS_CAMPANAS },
    );
  }
}

export async function GET(request: NextRequest) {
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
        error: "No tienes permiso para consultar el historial.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const params = request.nextUrl.searchParams;

    const idParam = params.get("id");

    if (idParam) {
      const id = Number(idParam);

      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
          {
            error: "El ID de la campaña no es válido.",
          },
          {
            status: 400,
          },
        );
      }

      await obtenerCampanaAutorizada(sesion, id);
      const campana = await consultarUno<CampanaWhatsapp>(
        `
            SELECT
              id::int
                AS id,

              fecha_creacion,
              usuario_creador,
              campana,
              gestor,
              desde,
              hasta,
              numero_salida,

              total_seleccionados::int
                AS total_seleccionados,

              total_preparados::int
                AS total_preparados,

              total_sin_telefono::int
                AS total_sin_telefono,

              total_fallidos::int
                AS total_fallidos,

              total_enviados::int
                AS total_enviados,

              (
                SELECT COUNT(*)::int
                FROM whatsapp_campana_destinatarios d
                WHERE d.campana_id = whatsapp_campanas.id
                  AND d.estado = 'INCIERTO'
              ) AS total_inciertos,

              estado

            FROM whatsapp_campanas

            WHERE
              id = $1

            LIMIT 1
          `,
        [id],
      );

      if (!campana) {
        return NextResponse.json(
          {
            error: "Campaña no encontrada.",
          },
          {
            status: 404,
          },
        );
      }

      const destinatarios = await consultarFilas<DestinatarioWhatsapp>(
        `
            SELECT
              id::int
                AS id,

              idc,
              cliente,
              gestor,
              telefono_destino,
              tipo_telefono,
              estado,
              error,
              fecha_procesamiento,
              mensaje,

              duracion_ms::int
                AS duracion_ms,

              tenor

            FROM whatsapp_campana_destinatarios

            WHERE
              campana_id = $1
              AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM cuentas a WHERE a.idc = whatsapp_campana_destinatarios.idc AND a.activo = 1 AND a.gestor = $2))
            ORDER BY
              id ASC
          `,
        [id, sesion.rol === "gestor" ? sesion.gestor : null],
      );

      return NextResponse.json(
        {
          campana,
          destinatarios,
        },
        { headers: CABECERAS_CAMPANAS },
      );
    }

    const q = params.get("q")?.trim() ?? "";

    const estado = params.get("estado")?.trim() ?? "";

    const condiciones: string[] = ["1 = 1"];

    const valores: unknown[] = [];

    function agregarParametro(valor: unknown): string {
      valores.push(valor);

      return `$${valores.length}`;
    }

    if (sesion.rol === "gestor") {
      validarAccesoCampanas(sesion);
      const p = agregarParametro(sesion.gestor);
      condiciones.push(
        "EXISTS (SELECT 1 FROM whatsapp_campana_destinatarios d JOIN cuentas a ON a.idc = d.idc AND a.activo = 1 WHERE d.campana_id = whatsapp_campanas.id AND a.gestor = " +
          p +
          ")",
      );
    }
    const modulo = params.get("modulo");
    if (modulo === "pdps") condiciones.push("campana LIKE 'PDP - %'");
    if (modulo === "gestiones") condiciones.push("campana NOT LIKE 'PDP - %'");
    if (q) {
      const parametro = agregarParametro(`%${q}%`);

      condiciones.push(`
        (
          campana ILIKE ${parametro}

          OR COALESCE(
            gestor,
            ''
          ) ILIKE ${parametro}

          OR numero_salida
            ILIKE ${parametro}

          OR COALESCE(
            usuario_creador,
            ''
          ) ILIKE ${parametro}
        )
      `);
    }

    if (estado) {
      const parametro = agregarParametro(estado);

      condiciones.push(`estado = ${parametro}`);
    }

    const limite = params.has("limite")
      ? Math.min(200, Math.max(1, Number(params.get("limite")) || 100))
      : null;
    const clausulaLimite = limite ? "LIMIT " + agregarParametro(limite) : "";
    const campanas = await consultarFilas<CampanaWhatsapp>(
      `
          SELECT
            id::int
              AS id,

            fecha_creacion,
            usuario_creador,
            campana,
            gestor,
            desde,
            hasta,
            numero_salida,

            total_seleccionados::int
              AS total_seleccionados,

            total_preparados::int
              AS total_preparados,

            total_sin_telefono::int
              AS total_sin_telefono,

            total_fallidos::int
              AS total_fallidos,

            total_enviados::int
              AS total_enviados,

            (
              SELECT COUNT(*)::int
              FROM whatsapp_campana_destinatarios d
              WHERE d.campana_id = whatsapp_campanas.id
                AND d.estado = 'INCIERTO'
            ) AS total_inciertos,

            estado

          FROM whatsapp_campanas

          WHERE
            ${condiciones.join(" AND ")}

          ORDER BY
            fecha_creacion DESC,
            id DESC
          ${clausulaLimite}
        `,
      valores,
    );

    return NextResponse.json(
      {
        campanas,
      },
      { headers: CABECERAS_CAMPANAS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ErrorCampanaWhatsapp
            ? error.message
            : "No se pudo consultar el historial.",
      },
      {
        status: error instanceof ErrorCampanaWhatsapp ? error.status : 500,
        headers: CABECERAS_CAMPANAS,
      },
    );
  }
}
