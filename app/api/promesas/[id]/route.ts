// app/api/promesas/[id]/route.ts
//
// PATCH:
// Edita una Promesa de Pago.
//
// DELETE:
// Elimina una Promesa de Pago.
//
// Exclusivo Supervisor + Administrador.

import { NextRequest, NextResponse } from "next/server";

import { consultarUno, ejecutar } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";
import {
  construirActualizacionPromesa,
  puedeModificarPromesas,
} from "@/lib/promesas";

import {
  TIPOS_PROMESA_PAGO,
  MODALIDADES_PAGO,
  TIPOS_NEGOCIACION,
  BENEFICIOS,
  STATUS_PDP,
  STATUS_PAGO,
} from "@/lib/catalogo-tipificacion";

export const runtime = "nodejs";

const ESTADOS_VALIDOS = ["vigente", "cumplida", "rota"];

type PromesaExistente = {
  id: number;
  idc?: string;
};

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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

  if (!puedeModificarPromesas(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para esto.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  const body = await request.json();

  const {
    estado,
    tipo,
    monto_prometido,
    modalidad_pago,
    tipo_negociacion,
    beneficio,
    status_pdp,
    status_pago,
    numero_cuotas_aprobadas,
  } = body;

  const promesa = await consultarUno<PromesaExistente>(
    `
        SELECT
          id,
          idc
        FROM promesas_pago
        WHERE id = $1
        LIMIT 1
      `,
    [id],
  );

  if (!promesa) {
    return NextResponse.json(
      {
        error: "Promesa no encontrada",
      },
      {
        status: 404,
      },
    );
  }

  if (estado != null && !ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json(
      {
        error: "Estado inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    tipo != null &&
    !TIPOS_PROMESA_PAGO.find((item) => item.codigo === tipo)
  ) {
    return NextResponse.json(
      {
        error: "Tipo de promesa inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    modalidad_pago != null &&
    modalidad_pago !== "" &&
    !MODALIDADES_PAGO.find((item) => item.codigo === modalidad_pago)
  ) {
    return NextResponse.json(
      {
        error: "Modalidad de pago inválida",
      },
      {
        status: 400,
      },
    );
  }

  if (
    tipo_negociacion != null &&
    tipo_negociacion !== "" &&
    !TIPOS_NEGOCIACION.includes(tipo_negociacion)
  ) {
    return NextResponse.json(
      {
        error: "Tipo de negociación inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    beneficio != null &&
    beneficio !== "" &&
    !BENEFICIOS.includes(beneficio)
  ) {
    return NextResponse.json(
      {
        error: "Beneficio inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    status_pdp != null &&
    status_pdp !== "" &&
    !STATUS_PDP.includes(status_pdp)
  ) {
    return NextResponse.json(
      {
        error: "Status PDP inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    status_pago != null &&
    status_pago !== "" &&
    !STATUS_PAGO.includes(status_pago)
  ) {
    return NextResponse.json(
      {
        error: "Status de pago inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    monto_prometido != null &&
    (typeof monto_prometido !== "number" || monto_prometido < 0)
  ) {
    return NextResponse.json(
      {
        error: "El monto prometido debe ser un número positivo",
      },
      {
        status: 400,
      },
    );
  }

  if (
    numero_cuotas_aprobadas != null &&
    (typeof numero_cuotas_aprobadas !== "number" || numero_cuotas_aprobadas < 0)
  ) {
    return NextResponse.json(
      {
        error: "El número de cuotas debe ser un número positivo",
      },
      {
        status: 400,
      },
    );
  }

  const actualizacion = construirActualizacionPromesa(body, id);

  if (!actualizacion) {
    return NextResponse.json(
      { error: "No se enviaron campos de la promesa para actualizar." },
      { status: 400 },
    );
  }

  const filasActualizadas = await ejecutar(
    actualizacion.sql,
    actualizacion.parametros,
  );

  if (filasActualizadas === 0) {
    return NextResponse.json(
      { error: "Promesa no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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

  if (!puedeModificarPromesas(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para esto.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  const promesa = await consultarUno<PromesaExistente>(
    `
        SELECT id
        FROM promesas_pago
        WHERE id = $1
        LIMIT 1
      `,
    [id],
  );

  if (!promesa) {
    return NextResponse.json(
      {
        error: "Promesa no encontrada",
      },
      {
        status: 404,
      },
    );
  }

  await ejecutar(
    `
      DELETE FROM promesas_pago
      WHERE id = $1
    `,
    [id],
  );

  return NextResponse.json({
    ok: true,
  });
}
