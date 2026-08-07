// app/api/cambiar-contrasena/route.ts
// Recibe la contraseña nueva, valida requisitos mínimos, la cifra
// y la guarda, marcando debe_cambiar_contrasena en 0.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual, cifrarContrasena } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { contrasenaNueva } = body;

  if (!contrasenaNueva || typeof contrasenaNueva !== "string") {
    return NextResponse.json(
      { error: "Falta la contraseña nueva" },
      { status: 400 },
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
      { status: 400 },
    );
  }

  const hashNuevo = await cifrarContrasena(contrasenaNueva);

  db.prepare(
    "UPDATE usuarios SET password_hash = ?, debe_cambiar_contrasena = 0 WHERE id = ?",
  ).run(hashNuevo, sesion.userId);

  return NextResponse.json({ ok: true });
}
