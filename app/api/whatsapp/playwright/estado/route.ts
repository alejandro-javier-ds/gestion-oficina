// app/api/whatsapp/playwright/estado/route.ts
//
// Consulta el estado de UNA sesión de WhatsApp Web.
//
// GET:
// /api/whatsapp/playwright/estado?numero=950793296

import { NextRequest, NextResponse } from "next/server";

import {
  obtenerEstadoWhatsapp,
  obtenerEstadosWhatsapp,
} from "@/lib/whatsapp/playwright";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor"];

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

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "No tienes permiso para consultar las sesiones de WhatsApp.",
      },
      {
        status: 403,
      },
    );
  }

  const numero = request.nextUrl.searchParams.get("numero")?.trim() ?? "";

  try {
    if (!numero) {
      const sesiones = await obtenerEstadosWhatsapp();

      return NextResponse.json({
        ok: true,

        sesiones,
      });
    }

    const estado = await obtenerEstadoWhatsapp(numero);

    return NextResponse.json({
      ok: true,

      ...estado,
    });
  } catch (error) {
    console.error("Error consultando sesiones WhatsApp:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el estado de WhatsApp.",
      },
      {
        status: 500,
      },
    );
  }
}
