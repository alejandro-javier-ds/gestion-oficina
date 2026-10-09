// Login con cinco intentos fallidos y bloqueo de treinta minutos.
import { NextRequest, NextResponse } from "next/server";
import { crearSesion, guardarCookieSesion } from "@/lib/auth";
import { autenticarUsuario, MINUTOS_BLOQUEO } from "@/lib/login";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { username?: unknown; contrasena?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }

  if (
    typeof body?.username !== "string" ||
    typeof body.contrasena !== "string" ||
    !body.username ||
    !body.contrasena
  ) {
    return NextResponse.json(
      { error: "Usuario y contraseña son obligatorios" },
      { status: 400 },
    );
  }

  const resultado = await autenticarUsuario(body.username, body.contrasena);

  if (resultado.tipo === "bloqueado") {
    const error = resultado.nuevo
      ? "Demasiados intentos fallidos. Tu cuenta quedó bloqueada por " +
      MINUTOS_BLOQUEO +
      " minutos."
      : "Demasiados intentos fallidos. Intenta de nuevo en " +
      resultado.minutos +
      " " +
      (resultado.minutos === 1 ? "minuto" : "minutos") +
      ".";
    return NextResponse.json({ error }, { status: 429 });
  }

  if (resultado.tipo === "incorrecto") {
    const restantes = resultado.intentosRestantes;
    const error =
      restantes === undefined
        ? "Usuario o contraseña incorrectos"
        : "Usuario o contraseña incorrectos. Te quedan " +
        restantes +
        " " +
        (restantes === 1 ? "intento" : "intentos") +
        ".";
    return NextResponse.json({ error }, { status: 401 });
  }

  const token = await crearSesion(resultado.sesion);
  await guardarCookieSesion(token);

  return NextResponse.json({
    ok: true,
    nombreCompleto: resultado.sesion.nombreCompleto,
    rol: resultado.sesion.rol,
    debeCambiarContrasena: resultado.sesion.debeCambiarContrasena,
  });
}
