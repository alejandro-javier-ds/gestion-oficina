// app/api/promesas/[id]/route.ts
// PATCH: edita una promesa de pago. Ampliado con los 5 campos
// Exclusivo Supervisor + Administrador.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import {
  TIPOS_PROMESA_PAGO,
  MODALIDADES_PAGO,
  TIPOS_NEGOCIACION,
  BENEFICIOS,
  STATUS_PDP,
  STATUS_PAGO,
  TIPO_CAMBIO_REFERENCIAL,
} from "@/lib/catalogo-tipificacion";

const ESTADOS_VALIDOS = ["vigente", "cumplida", "rota"];
const ROLES_QUE_PUEDEN_EDITAR = ["supervisor", "administrador"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para esto." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const {
    estado,
    tipo,
    moneda,
    monto_prometido,
    modalidad_pago,
    observacion,
    fecha_promesa,
    tipo_negociacion,
    beneficio,
    status_pdp,
    status_pago,
    numero_cuotas_aprobadas,
  } = body;

  const promesa = db
    .prepare("SELECT idc FROM promesas_pago WHERE id = ?")
    .get(id) as { idc: string } | undefined;

  if (!promesa) {
    return NextResponse.json(
      { error: "Promesa no encontrada" },
      { status: 404 },
    );
  }

  if (estado != null && !ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  if (tipo != null && !TIPOS_PROMESA_PAGO.find((t) => t.codigo === tipo)) {
    return NextResponse.json(
      { error: "Tipo de promesa inválido" },
      { status: 400 },
    );
  }

  if (
    modalidad_pago != null &&
    modalidad_pago !== "" &&
    !MODALIDADES_PAGO.find((m) => m.codigo === modalidad_pago)
  ) {
    return NextResponse.json(
      { error: "Modalidad de pago inválida" },
      { status: 400 },
    );
  }

  if (
    tipo_negociacion != null &&
    tipo_negociacion !== "" &&
    !TIPOS_NEGOCIACION.includes(tipo_negociacion)
  ) {
    return NextResponse.json(
      { error: "Tipo de negociación inválido" },
      { status: 400 },
    );
  }

  if (
    beneficio != null &&
    beneficio !== "" &&
    !BENEFICIOS.includes(beneficio)
  ) {
    return NextResponse.json({ error: "Beneficio inválido" }, { status: 400 });
  }

  if (
    status_pdp != null &&
    status_pdp !== "" &&
    !STATUS_PDP.includes(status_pdp)
  ) {
    return NextResponse.json({ error: "Status PDP inválido" }, { status: 400 });
  }

  if (
    status_pago != null &&
    status_pago !== "" &&
    !STATUS_PAGO.includes(status_pago)
  ) {
    return NextResponse.json(
      { error: "Status de pago inválido" },
      { status: 400 },
    );
  }

  if (
    monto_prometido != null &&
    (typeof monto_prometido !== "number" || monto_prometido < 0)
  ) {
    return NextResponse.json(
      { error: "El monto prometido debe ser un número positivo" },
      { status: 400 },
    );
  }

  if (
    numero_cuotas_aprobadas != null &&
    (typeof numero_cuotas_aprobadas !== "number" || numero_cuotas_aprobadas < 0)
  ) {
    return NextResponse.json(
      { error: "El número de cuotas debe ser un número positivo" },
      { status: 400 },
    );
  }

  const modalidadValida = modalidad_pago
    ? MODALIDADES_PAGO.find((m) => m.codigo === modalidad_pago)
    : null;

  const montoDolaresActualizado =
    monto_prometido != null
      ? moneda === "Soles" || moneda === "PEN"
        ? Number((monto_prometido / TIPO_CAMBIO_REFERENCIAL).toFixed(2))
        : null
      : null;

  db.prepare(
    `
    UPDATE promesas_pago SET
      estado = COALESCE(@estado, estado),
      tipo = COALESCE(@tipo, tipo),
      moneda = COALESCE(@moneda, moneda),
      monto_prometido = @monto_prometido,
      monto_dolares = @monto_dolares,
      modalidad_pago = @modalidad_pago,
      observacion = @observacion,
      fecha_promesa = COALESCE(@fecha_promesa, fecha_promesa),
      tipo_negociacion = @tipo_negociacion,
      beneficio = @beneficio,
      status_pdp = @status_pdp,
      status_pago = @status_pago,
      numero_cuotas_aprobadas = @numero_cuotas_aprobadas
    WHERE id = @id
  `,
  ).run({
    id,
    estado: estado ?? null,
    tipo: tipo ?? null,
    moneda: moneda ?? null,
    monto_prometido: monto_prometido !== undefined ? monto_prometido : null,
    monto_dolares: montoDolaresActualizado,
    modalidad_pago: modalidadValida
      ? `${modalidadValida.codigo} - ${modalidadValida.descripcion}`
      : null,
    observacion: observacion !== undefined ? observacion : null,
    fecha_promesa: fecha_promesa ?? null,
    tipo_negociacion:
      tipo_negociacion !== undefined ? tipo_negociacion || null : null,
    beneficio: beneficio !== undefined ? beneficio || null : null,
    status_pdp: status_pdp !== undefined ? status_pdp || null : null,
    status_pago: status_pago !== undefined ? status_pago || null : null,
    numero_cuotas_aprobadas:
      numero_cuotas_aprobadas !== undefined ? numero_cuotas_aprobadas : null,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para esto." },
      { status: 403 },
    );
  }

  const { id } = await params;

  const promesa = db
    .prepare("SELECT id FROM promesas_pago WHERE id = ?")
    .get(id);

  if (!promesa) {
    return NextResponse.json(
      { error: "Promesa no encontrada" },
      { status: 404 },
    );
  }

  db.prepare("DELETE FROM promesas_pago WHERE id = ?").run(id);

  return NextResponse.json({ ok: true });
}
