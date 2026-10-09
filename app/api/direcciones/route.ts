// app/api/direcciones/route.ts
//
// POST:
// Agrega una dirección manual para un cliente.
//
// Las direcciones manuales se guardan con:
// fuente = 'manual'

import { NextRequest, NextResponse } from "next/server";

import { consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];

const TIPOS_VALIDOS = ["Domicilio", "Comercial", "Otro"];

type Existe = {
  existe: number;
};

type DireccionInsertada = {
  id: number;
};

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

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para esto.",
      },
      {
        status: 403,
      },
    );
  }

  const body = await request.json();

  const { idc, direccion, distrito, provincia, departamento, tipo } = body;

  if (!idc || !direccion) {
    return NextResponse.json(
      {
        error: "Faltan campos obligatorios (idc, direccion)",
      },
      {
        status: 400,
      },
    );
  }

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      {
        error: "Tipo de dirección inválido",
      },
      {
        status: 400,
      },
    );
  }

  const clienteExiste = await consultarUno<Existe>(
    `
      SELECT
        1 AS existe
      FROM cuentas
      WHERE idc = $1
        AND activo = 1
      LIMIT 1
    `,
    [idc],
  );

  if (!clienteExiste) {
    return NextResponse.json(
      {
        error: "El cliente no existe o no tiene cuentas activas",
      },
      {
        status: 404,
      },
    );
  }

  const ahora = new Date().toISOString();

  const resultado = await consultarUno<DireccionInsertada>(
    `
      INSERT INTO direcciones (
        idc,
        direccion,
        distrito,
        provincia,
        departamento,
        tipo,
        fuente,
        creado_por,
        editado_por,
        fecha_modificacion,
        activo
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'manual',
        $7,
        $7,
        $8,
        1
      )
      RETURNING
        id::int AS id
    `,
    [
      idc,
      direccion,
      distrito ?? null,
      provincia ?? null,
      departamento ?? null,
      tipo ?? "Domicilio",
      sesion.nombreCompleto,
      ahora,
    ],
  );

  if (!resultado) {
    throw new Error("PostgreSQL no devolvió el ID de la dirección creada.");
  }

  return NextResponse.json({
    ok: true,
    id: resultado.id,
  });
}
