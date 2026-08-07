// app/api/admin/usuarios/route.ts
// GET: lista los usuarios (sin exponer el hash de la contraseña).
// POST: crea un usuario nuevo, con contraseña temporal generada
// automáticamente, marcado para que la cambie en su primer login.
// Roles válidos: administrador, supervisor, abogado, gestor.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { cifrarContrasena } from "@/lib/auth";

type UsuarioListado = {
  id: number;
  username: string;
  nombre_completo: string;
  gestor: string | null;
  rol: string;
  activo: number;
};

const ROLES_VALIDOS = ["administrador", "supervisor", "abogado", "gestor"];

export async function GET() {
  const usuarios = db
    .prepare(
      "SELECT id, username, nombre_completo, gestor, rol, activo FROM usuarios ORDER BY nombre_completo",
    )
    .all() as UsuarioListado[];

  return NextResponse.json({ usuarios });
}

function generarContrasenaTemporal(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const mayusculas = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numeros = "23456789";

  let resultado = "";
  resultado += mayusculas[Math.floor(Math.random() * mayusculas.length)];
  resultado += numeros[Math.floor(Math.random() * numeros.length)];
  for (let i = 0; i < 8; i++) {
    resultado += letras[Math.floor(Math.random() * letras.length)];
  }
  return resultado;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, nombreCompleto, rol, gestor } = body;

  if (!username || !nombreCompleto || !rol) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios: username, nombreCompleto, rol" },
      { status: 400 },
    );
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json(
      { error: `El rol debe ser uno de: ${ROLES_VALIDOS.join(", ")}` },
      { status: 400 },
    );
  }

  if (rol === "gestor" && !gestor) {
    return NextResponse.json(
      {
        error:
          'Para rol "gestor" debes indicar a qué gestor de la cartera corresponde',
      },
      { status: 400 },
    );
  }

  const existente = db
    .prepare("SELECT id FROM usuarios WHERE username = ?")
    .get(username);
  if (existente) {
    return NextResponse.json(
      { error: `Ya existe un usuario con username "${username}"` },
      { status: 409 },
    );
  }

  const contrasenaTemporal = generarContrasenaTemporal();
  const hash = await cifrarContrasena(contrasenaTemporal);
  const ahora = new Date().toISOString();

  const resultado = db
    .prepare(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, gestor, rol, debe_cambiar_contrasena, activo, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
    )
    .run(
      username,
      hash,
      nombreCompleto,
      rol === "gestor" ? gestor : null,
      rol,
      ahora,
    );

  return NextResponse.json({
    ok: true,
    id: resultado.lastInsertRowid,
    contrasenaTemporal,
  });
}
