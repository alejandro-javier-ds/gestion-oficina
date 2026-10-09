// app/api/telefonos/route.ts
//
// POST:
// Agrega manualmente un teléfono para un cliente.
//
// Los teléfonos manuales se guardan con:
// agregado_manualmente = 1

import { NextRequest, NextResponse } from "next/server";

import { consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { clasificarTelefono } from "@/lib/mapeo-columnas";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];

type Existe = {
  existe: number;
};

type TelefonoInsertado = {
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

  const { idc, phone } = body;

  if (!idc || !phone) {
    return NextResponse.json(
      {
        error: "Faltan campos obligatorios (idc, phone)",
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

  const numero = String(phone).trim();

  const ahora = new Date().toISOString();

  const resultado = await consultarUno<TelefonoInsertado>(
    `
      INSERT INTO telefonos (
        idc,
        phone,
        tipo_telefono,
        creado_por,
        editado_por,
        fecha_modificacion,
        agregado_manualmente,
        activo
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $4,
        $5,
        1,
        1
      )
      RETURNING
        id_phone::int AS id
    `,
    [idc, numero, clasificarTelefono(numero), sesion.nombreCompleto, ahora],
  );

  if (!resultado) {
    throw new Error("PostgreSQL no devolvió el ID del teléfono creado.");
  }

  return NextResponse.json({
    ok: true,
    id: resultado.id,
  });
}
