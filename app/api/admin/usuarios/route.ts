// app/api/admin/usuarios/route.ts
//
// GET: lista usuarios sin exponer password_hash.
// POST: crea usuario con contraseña temporal.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { cifrarContrasena } from "@/lib/auth";

export const runtime = "nodejs";

type UsuarioListado = {
  id: number;
  username: string;
  nombre_completo: string;
  gestor: string | null;
  rol: string;
  activo: number;
};

type UsuarioExistente = {
  id: number;
};

type UsuarioInsertado = {
  id: number;
};

const ROLES_VALIDOS = ["administrador", "supervisor", "abogado", "gestor"];

export async function GET() {
  const usuarios = await consultarFilas<UsuarioListado>(
    `
        SELECT
          id::int AS id,
          username,
          nombre_completo,
          gestor,
          rol,
          activo

        FROM usuarios

        ORDER BY
          nombre_completo
      `,
  );

  return NextResponse.json({
    usuarios,
  });
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
      {
        error: "Faltan campos obligatorios: username, nombreCompleto, rol",
      },
      {
        status: 400,
      },
    );
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json(
      {
        error: `El rol debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
      },
      {
        status: 400,
      },
    );
  }

  if (rol === "gestor" && !gestor) {
    return NextResponse.json(
      {
        error:
          'Para rol "gestor" debes indicar a qué gestor de la cartera corresponde',
      },
      {
        status: 400,
      },
    );
  }

  const existente = await consultarUno<UsuarioExistente>(
    `
        SELECT
          id::int AS id
        FROM usuarios
        WHERE username = $1
      `,
    [username],
  );

  if (existente) {
    return NextResponse.json(
      {
        error: `Ya existe un usuario con username "${username}"`,
      },
      {
        status: 409,
      },
    );
  }

  const contrasenaTemporal = generarContrasenaTemporal();

  const hash = await cifrarContrasena(contrasenaTemporal);

  const ahora = new Date().toISOString();

  try {
    const resultado = await consultarUno<UsuarioInsertado>(
      `
          INSERT INTO usuarios (
            username,
            password_hash,
            nombre_completo,
            gestor,
            rol,
            debe_cambiar_contrasena,
            activo,
            fecha_creacion
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            1,
            1,
            $6
          )
          RETURNING
            id::int AS id
        `,
      [
        username,
        hash,
        nombreCompleto,
        rol === "gestor" ? gestor : null,
        rol,
        ahora,
      ],
    );

    if (!resultado) {
      throw new Error("No se pudo obtener el ID del usuario creado.");
    }

    return NextResponse.json({
      ok: true,
      id: resultado.id,
      contrasenaTemporal,
    });
  } catch (error) {
    const errorPg = error as {
      code?: string;
    };
    if (errorPg.code === "23505") {
      return NextResponse.json(
        {
          error: `Ya existe un usuario con username "${username}"`,
        },
        {
          status: 409,
        },
      );
    }

    throw error;
  }
}
