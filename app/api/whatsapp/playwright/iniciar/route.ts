// app/api/whatsapp/playwright/iniciar/route.ts
//
// Inicia una sesión independiente de WhatsApp Web.
//
// temporal = false
//   -> sesión permanente
//
// temporal = true
//   -> sesión temporal

import { NextRequest, NextResponse } from "next/server";

import { iniciarWhatsapp } from "@/lib/whatsapp/playwright";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor"];

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
        error:
          "Solo administrador o supervisor pueden vincular números de WhatsApp.",
      },
      {
        status: 403,
      },
    );
  }

  let body: {
    numero?: unknown;
    temporal?: unknown;
  } | null = null;

  try {
    body = (await request.json()) as {
      numero?: unknown;
      temporal?: unknown;
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

  const numero = typeof body?.numero === "string" ? body.numero.trim() : "";

  const temporal = body?.temporal === true;

  if (!numero) {
    return NextResponse.json(
      {
        error: "Debes indicar el número de WhatsApp.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const estado = await iniciarWhatsapp(numero, temporal);

    return NextResponse.json({
      ok: true,
      ...estado,
    });
  } catch (error) {
    console.error("Error iniciando sesión WhatsApp:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la sesión de WhatsApp.",
      },
      {
        status: 500,
      },
    );
  }
}
