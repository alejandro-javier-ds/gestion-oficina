// app/api/login/route.ts
// Recibe username + contraseña, verifica contra la BD, y si es
// correcto crea la cookie de sesión. Agregado: límite de 5 intentos
// fallidos seguidos, con bloqueo de 30 minutos — protege contra
// que alguien intente adivinar contraseñas a la fuerza.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  verificarContrasena,
  crearSesion,
  guardarCookieSesion,
  Rol,
} from "@/lib/auth";

const INTENTOS_MAXIMOS = 5;
const MINUTOS_BLOQUEO = 30;

type Usuario = {
  id: number;
  username: string;
  password_hash: string;
  nombre_completo: string;
  gestor: string | null;
  rol: Rol;
  debe_cambiar_contrasena: number;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
  activo: number;
};

function minutosRestantes(bloqueadoHasta: string): number {
  const restante = new Date(bloqueadoHasta).getTime() - Date.now();
  return Math.max(1, Math.ceil(restante / 60000));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, contrasena } = body;

  if (!username || !contrasena) {
    return NextResponse.json(
      { error: "Usuario y contraseña son obligatorios" },
      { status: 400 },
    );
  }

  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE username = ? AND activo = 1")
    .get(username) as Usuario | undefined;

  if (!usuario) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 },
    );
  }

  if (
    usuario.bloqueado_hasta &&
    new Date(usuario.bloqueado_hasta).getTime() > Date.now()
  ) {
    const minutos = minutosRestantes(usuario.bloqueado_hasta);
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
      },
      { status: 429 },
    );
  }

  const contrasenaValida = await verificarContrasena(
    contrasena,
    usuario.password_hash,
  );

  if (!contrasenaValida) {
    const nuevosIntentos = usuario.intentos_fallidos + 1;

    if (nuevosIntentos >= INTENTOS_MAXIMOS) {
      const bloqueadoHasta = new Date(
        Date.now() + MINUTOS_BLOQUEO * 60000,
      ).toISOString();
      db.prepare(
        "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?",
      ).run(bloqueadoHasta, usuario.id);
      return NextResponse.json(
        {
          error: `Demasiados intentos fallidos. Tu cuenta quedó bloqueada por ${MINUTOS_BLOQUEO} minutos.`,
        },
        { status: 429 },
      );
    }

    db.prepare("UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?").run(
      nuevosIntentos,
      usuario.id,
    );
    const restantes = INTENTOS_MAXIMOS - nuevosIntentos;
    return NextResponse.json(
      {
        error: `Usuario o contraseña incorrectos. Te quedan ${restantes} ${restantes === 1 ? "intento" : "intentos"}.`,
      },
      { status: 401 },
    );
  }

  db.prepare(
    "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?",
  ).run(usuario.id);

  const token = await crearSesion({
    userId: usuario.id,
    username: usuario.username,
    nombreCompleto: usuario.nombre_completo,
    gestor: usuario.gestor,
    rol: usuario.rol,
    debeCambiarContrasena: usuario.debe_cambiar_contrasena === 1,
  });

  await guardarCookieSesion(token);

  return NextResponse.json({
    ok: true,
    nombreCompleto: usuario.nombre_completo,
    rol: usuario.rol,
    debeCambiarContrasena: usuario.debe_cambiar_contrasena === 1,
  });
}
