// app/api/whatsapp/progreso/route.ts
// Lee directamente los estados de whatsapp_campana_destinatarios.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar el progreso." },
      { status: 403 },
    );
  }

  const campanaId = Number(request.nextUrl.searchParams.get("campanaId"));

  if (!Number.isInteger(campanaId) || campanaId <= 0) {
    return NextResponse.json(
      { error: "El ID de campaña no es válido." },
      { status: 400 },
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
      .get(campanaId) as
      | {
        id: number;
        numero_salida: string;
        estado: string;
        total_seleccionados: number;
        total_preparados: number;
        total_sin_telefono: number;
        total_fallidos: number;
        total_enviados: number;
      }
      | undefined;

    if (!campana) {
      return NextResponse.json(
        { error: "La campaña no existe." },
        { status: 404 },
      );
    }

    const conteo = db
      .prepare(
        `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'ENVIADO' THEN 1 ELSE 0 END) AS enviados,
        SUM(CASE WHEN estado = 'ERROR' THEN 1 ELSE 0 END) AS errores,
        SUM(CASE WHEN estado = 'SIN_TELEFONO' THEN 1 ELSE 0 END) AS sin_telefono,
        SUM(CASE WHEN estado = 'PREPARADO' THEN 1 ELSE 0 END) AS preparados
      FROM whatsapp_campana_destinatarios
      WHERE campana_id = ?
    `,
      )
      .get(campanaId) as {
        total: number | null;
        enviados: number | null;
        errores: number | null;
        sin_telefono: number | null;
        preparados: number | null;
      };

    const total = Number(conteo?.total ?? 0);
    const enviados = Number(conteo?.enviados ?? 0);
    const errores = Number(conteo?.errores ?? 0);
    const sinTelefono = Number(conteo?.sin_telefono ?? 0);
    const preparados = Number(conteo?.preparados ?? 0);
    const procesados = enviados + errores + sinTelefono;
    const pendientes = Math.max(0, total - procesados);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error consultando progreso WhatsApp:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el progreso.",
      },
      { status: 500 },
    );
  }
}
