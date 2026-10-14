// app/api/gestiones/route.ts
//
// GET:
// Consulta las gestiones de un cliente.
//
// POST:
// Registra una nueva gestión.
//
// Regla de colaboración:
// los gestores pueden consultar y registrar gestiones
// sobre clientes asignados a cualquier gestor.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";
import { columnaFechaLimaSql } from "@/lib/fecha-lima";

import {
  SEGMENTACIONES,
  admiteGestionSinRazon,
} from "@/lib/catalogo-tipificacion";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_REGISTRAR = ["gestor", "supervisor"];

type Existe = {
  existe: number;
};

type GestionInsertada = {
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

  const categoria = request.nextUrl.searchParams.get("categoria");

  const desde = request.nextUrl.searchParams.get("desde");

  const hasta = request.nextUrl.searchParams.get("hasta");

  const orden =
    request.nextUrl.searchParams.get("orden") === "antiguas" ? "ASC" : "DESC";

  const fechaGestionLima = columnaFechaLimaSql("fecha_hora");

  const condiciones: string[] = ["idc = $1"];

  const parametros: unknown[] = [idc];

  let siguienteParametro = 2;

  if (categoria && categoria !== "TODAS") {
    condiciones.push(`categoria = $${siguienteParametro}`);

    parametros.push(categoria);

    siguienteParametro++;
  }

  if (desde) {
    condiciones.push(`${fechaGestionLima} >= $${siguienteParametro}::date`);

    parametros.push(desde);

    siguienteParametro++;
  }

  if (hasta) {
    condiciones.push(`${fechaGestionLima} <= $${siguienteParametro}::date`);

    parametros.push(hasta);

    siguienteParametro++;
  }

  const gestiones = await consultarFilas(
    `
      SELECT *
      FROM gestiones
      WHERE ${condiciones.join(" AND ")}
      ORDER BY fecha_hora ${orden}
    `,
    parametros,
  );

  return NextResponse.json({
    gestiones,
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
        error: "Tu rol no tiene permiso para registrar gestiones.",
      },
      {
        status: 403,
      },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "El cuerpo de la gestión debe ser un objeto JSON válido." },
      { status: 400 },
    );
  }

  const {
    idc,
    codcuentacobranza,
    categoria,
    codigo_razon,
    segmentacion,
    telefono,
    monto_compromiso,
    monto_pagado,
    moneda_monto_pagado,
    fecha_promesa,
    observacion,
  } = body;

  if (!idc) {
    return NextResponse.json(
      {
        error: "Falta el campo idc",
      },
      {
        status: 400,
      },
    );
  }

  if (codigo_razon != null && typeof codigo_razon !== "string") {
    return NextResponse.json(
      { error: "La razón de la gestión debe ser texto." },
      { status: 400 },
    );
  }

  const codigoRazon = codigo_razon?.trim() || null;

  if (!admiteGestionSinRazon(categoria) && !codigoRazon) {
    return NextResponse.json(
      { error: "Selecciona TAT, MCT, TIN u otra gestión antes de guardar." },
      { status: 400 },
    );
  }

  if (!segmentacion || !SEGMENTACIONES.includes(segmentacion)) {
    return NextResponse.json(
      {
        error:
          "La Segmentación es obligatoria y debe ser una de las opciones válidas.",
      },
      {
        status: 400,
      },
    );
  }

  if (!telefono || typeof telefono !== "string" || telefono.trim() === "") {
    return NextResponse.json(
      {
        error: "El teléfono al que se llamó es obligatorio.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    monto_pagado != null &&
    (typeof monto_pagado !== "number" || monto_pagado < 0)
  ) {
    return NextResponse.json(
      {
        error: "El monto pagado debe ser un número positivo",
      },
      {
        status: 400,
      },
    );
  }

  if (
    monto_pagado != null &&
    moneda_monto_pagado != null &&
    !["Soles", "Dolares", "Dólares"].includes(moneda_monto_pagado)
  ) {
    return NextResponse.json(
      {
        error: "Moneda del monto pagado inválida",
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

  if (codcuentacobranza) {
    const cuentaPerteneceAlCliente = await consultarUno<Existe>(
      `
        SELECT
          1 AS existe
        FROM cuentas
        WHERE codcuentacobranza = $1
          AND idc = $2
        LIMIT 1
      `,
      [codcuentacobranza, idc],
    );

    if (!cuentaPerteneceAlCliente) {
      return NextResponse.json(
        {
          error: "La cuenta indicada no pertenece a este cliente",
        },
        {
          status: 400,
        },
      );
    }
  }

  const ahora = new Date().toISOString();

  const resultado = await consultarUno<GestionInsertada>(
    `
      INSERT INTO gestiones (
        idc,
        codcuentacobranza,
        usuario_gestor_oficina,
        categoria,
        codigo_razon,
        segmentacion,
        telefono,
        fecha_hora,
        monto_compromiso,
        monto_pagado,
        moneda_monto_pagado,
        fecha_promesa,
        observacion
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
      RETURNING id
    `,
    [
      idc,
      codcuentacobranza ?? null,
      sesion.nombreCompleto,
      categoria ?? null,
      codigoRazon,
      segmentacion,
      telefono.trim(),
      ahora,
      monto_compromiso ?? null,
      monto_pagado ?? null,
      monto_pagado != null ? (moneda_monto_pagado ?? "Soles") : null,
      fecha_promesa ?? null,
      observacion ?? null,
    ],
  );

  if (!resultado) {
    throw new Error("PostgreSQL no devolvió el ID de la gestión creada.");
  }

  return NextResponse.json({
    ok: true,
    id: resultado.id,
  });
}
