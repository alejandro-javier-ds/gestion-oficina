// app/api/cambiar-contrasena/route.ts
//
// Recibe una contraseña nueva, valida requisitos mínimos,
// la cifra y la guarda en PostgreSQL.

import { NextRequest, NextResponse } from "next/server";

import { ejecutar } from "@/lib/postgres";

import { leerSesionActual, cifrarContrasena } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado",
      },
      {
        status: 401,
      },
    );
  }

  const body = await request.json();

  const { contrasenaNueva } = body;

  if (!contrasenaNueva || typeof contrasenaNueva !== "string") {
    return NextResponse.json(
      {
        error: "Falta la contraseña nueva",
      },
      {
        status: 400,
      },
    );
  }

  const tieneLongitudMinima = contrasenaNueva.length >= 8;

  const tieneMinuscula = /[a-z]/.test(contrasenaNueva);

  const tieneMayuscula = /[A-Z]/.test(contrasenaNueva);

  const tieneNumero = /[0-9]/.test(contrasenaNueva);

  if (
    !tieneLongitudMinima ||
    !tieneMinuscula ||
    !tieneMayuscula ||
    !tieneNumero
  ) {
    return NextResponse.json(
      {
        error:
          "La contraseña debe tener al menos 8 caracteres, con al menos una minúscula, una mayúscula y un número.",
      },
      {
        status: 400,
      },
    );
  }

  const hashNuevo = await cifrarContrasena(contrasenaNueva);

  await ejecutar(
    `
      UPDATE usuarios
      SET
        password_hash = $1,
        debe_cambiar_contrasena = 0
      WHERE id = $2
    `,
    [hashNuevo, sesion.userId],
  );

  return NextResponse.json({
    ok: true,
  });
}
