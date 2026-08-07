// app/api/whatsapp/playwright/cerrar-temporal/route.ts
//
// Cierra y elimina una sesión temporal.
//
// NO toca:
// - whatsapp_numeros
// - campañas
// - clientes
// - ninguna otra tabla.
//
// Solo elimina la sesión temporal de Playwright.

import { NextRequest, NextResponse } from "next/server";

import { cerrarYEliminarWhatsappTemporal } from "@/lib/whatsapp/playwright";

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
        error: "No tienes permiso para cerrar sesiones temporales.",
      },
      {
        status: 403,
      },
    );
  }

  let body: {
    numero?: unknown;
  } | null = null;

  try {
    body = (await request.json()) as {
      numero?: unknown;
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

  if (!numero) {
    return NextResponse.json(
      {
        error: "Debes indicar el número temporal.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    await cerrarYEliminarWhatsappTemporal(numero);

    return NextResponse.json({
      ok: true,

      numero,

      mensaje:
        "La sesión temporal se cerró y su perfil de WhatsApp Web fue eliminado.",
    });
  } catch (error) {
    console.error("Error cerrando sesión temporal:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cerrar la sesión temporal.",
      },
      {
        status: 500,
      },
    );
  }
}
