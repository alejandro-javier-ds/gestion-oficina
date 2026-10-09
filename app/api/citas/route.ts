// app/api/citas/route.ts
//
// GET:
// Lista las citas de un cliente.
//
// POST:
// Crea una cita nueva.
// CIH = cita para hoy.
// CIT = cita para otra fecha.
//
// Regla de colaboración:
// los gestores pueden consultar y registrar citas
// sobre clientes asignados a cualquier gestor.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_REGISTRAR = ["gestor", "supervisor"];

const TIPOS_VALIDOS = ["CIH", "CIT"];

type Existe = {
  existe: number;
};

type CitaInsertada = {
  id: number;
};

export async function GET(request: NextRequest) {
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

  const idc = request.nextUrl.searchParams.get("idc");

  if (!idc) {
    return NextResponse.json(
      {
        error: "Falta el parámetro idc",
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

  const citas = await consultarFilas(
    `
      SELECT *
      FROM citas
      WHERE idc = $1
      ORDER BY fecha_cita DESC
    `,
    [idc],
  );

  return NextResponse.json({
    citas,
  });
}

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

  if (!ROLES_QUE_PUEDEN_REGISTRAR.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para registrar citas.",
      },
      {
        status: 403,
      },
    );
  }

  const body = await request.json();

  const { idc, tipo, fecha_cita, observacion } = body;

  if (!idc || !tipo) {
    return NextResponse.json(
      {
        error: "Faltan campos obligatorios (idc, tipo)",
      },
      {
        status: 400,
      },
    );
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      {
        error: "Tipo de cita inválido",
      },
      {
        status: 400,
      },
    );
  }

  let fechaFinal: string;

  if (tipo === "CIH") {
    fechaFinal = new Date().toISOString().slice(0, 10);
  } else {
    if (!fecha_cita) {
      return NextResponse.json(
        {
          error: "CIT requiere una fecha de cita",
        },
        {
          status: 400,
        },
      );
    }

    fechaFinal = fecha_cita;
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

  const resultado = await consultarUno<CitaInsertada>(
    `
      INSERT INTO citas (
        idc,
        tipo,
        fecha_cita,
        observacion,
        estado,
        usuario_gestor_oficina,
        fecha_hora
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'pendiente',
        $5,
        $6
      )
      RETURNING id::int AS id
    `,
    [idc, tipo, fechaFinal, observacion ?? null, sesion.nombreCompleto, ahora],
  );

  if (!resultado) {
    throw new Error("PostgreSQL no devolvió el ID de la cita creada.");
  }

  return NextResponse.json({
    ok: true,
    id: resultado.id,
  });
}
