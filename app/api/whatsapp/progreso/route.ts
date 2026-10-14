// app/api/whatsapp/progreso/route.ts
//
// Lee directamente los estados de
// whatsapp_campana_destinatarios.

import { NextRequest, NextResponse } from "next/server";

import { consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import {
  obtenerCampanaAutorizada,
  DESTINOS_ACTUALES_SQL,
  CABECERAS_CAMPANAS,
  ErrorCampanaWhatsapp,
} from "@/lib/whatsapp/campanas";
export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

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

type Conteo = {
  total: number;
  enviados: number;
  errores: number;
  sin_telefono: number;
  preparados: number;
};

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
        error: "No tienes permiso para consultar el progreso.",
      },
      {
        status: 403,
      },
    );
  }

  const campanaId = Number(request.nextUrl.searchParams.get("campanaId"));

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
    await obtenerCampanaAutorizada(sesion, campanaId);
    const campana = await consultarUno<Campana>(
      `
          SELECT
            id::int AS id,
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

          FROM whatsapp_campanas

          WHERE id = $1

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

    const conteo = await consultarUno<Conteo>(
      `
          SELECT
            COUNT(*)::int
              AS total,

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
              AS sin_telefono,

            COUNT(*) FILTER (
              WHERE estado = 'PREPARADO'
            )::int
              AS preparados

          FROM (${DESTINOS_ACTUALES_SQL}) AS actuales
        `,
      [campanaId],
    );

    const total = conteo?.total ?? 0;

    const enviados = conteo?.enviados ?? 0;

    const errores = conteo?.errores ?? 0;

    const sinTelefono = conteo?.sin_telefono ?? 0;

    const preparados = conteo?.preparados ?? 0;

    const procesados = enviados + errores + sinTelefono;

    const pendientes = Math.max(0, total - procesados);

    return NextResponse.json(
      {
        ok: true,

        campanaId,

        numeroSalida: campana.numero_salida,

        estado: campana.estado,

        total,

        procesados,

        enviados,

        fallidos: errores,

        sinTelefono,

        preparados,

        pendientes,
      },
      { headers: CABECERAS_CAMPANAS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ErrorCampanaWhatsapp
            ? error.message
            : "No se pudo consultar el progreso.",
      },
      {
        status: error instanceof ErrorCampanaWhatsapp ? error.status : 500,
        headers: CABECERAS_CAMPANAS,
      },
    );
  }
}
