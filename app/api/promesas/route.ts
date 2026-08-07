// app/api/promesas/route.ts
// GET: lista Promesas de Pago. POST: crea una promesa + su gestión
// vinculada. La gestión vinculada siempre se crea con
// segmentacion='CONTACTO CON NEGOCIACION', fija — no se le pregunta
// al gestor, toda promesa de pago implica negociación.

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
  ESTUDIO_FIJO,
  MATRIZ_FIJA,
  TIPO_CAMBIO_REFERENCIAL,
  SEGMENTACION_FIJA_PDP,
} from "@/lib/catalogo-tipificacion";

const ROLES_QUE_PUEDEN_REGISTRAR = ["gestor", "supervisor"];

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const idc = request.nextUrl.searchParams.get("idc");
  const codcuentacobranza =
    request.nextUrl.searchParams.get("codcuentacobranza");

  if (!idc && !codcuentacobranza) {
    return NextResponse.json(
      { error: "Falta el parámetro idc o codcuentacobranza" },
      { status: 400 },
    );
  }

  const idcParaChequear =
    idc ??
    (
      db
        .prepare("SELECT idc FROM cuentas WHERE codcuentacobranza = ?")
        .get(codcuentacobranza) as { idc: string } | undefined
    )?.idc;

  if (sesion.rol === "gestor" && idcParaChequear) {
    const perteneceAlGestor = db
      .prepare("SELECT 1 FROM cuentas WHERE idc = ? AND gestor = ? LIMIT 1")
      .get(idcParaChequear, sesion.gestor);

    if (!perteneceAlGestor) {
      return NextResponse.json(
        { error: "No tienes acceso a este cliente" },
        { status: 403 },
      );
    }
  }

  const promesas = codcuentacobranza
    ? db
      .prepare(
        "SELECT * FROM promesas_pago WHERE codcuentacobranza = ? ORDER BY fecha_hora DESC",
      )
      .all(codcuentacobranza)
    : db
      .prepare(
        "SELECT * FROM promesas_pago WHERE idc = ? ORDER BY fecha_hora DESC",
      )
      .all(idc);

  return NextResponse.json({ promesas });
}

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_REGISTRAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para registrar promesas de pago." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const {
    idc,
    codcuentacobranza,
    tipo,
    moneda,
    fecha_promesa,
    monto_prometido,
    modalidad_pago,
    observacion,
    tipo_negociacion,
    beneficio,
    status_pdp,
    status_pago,
    numero_cuotas_aprobadas,
  } = body;

  if (!idc || !codcuentacobranza || !tipo || !moneda || !fecha_promesa) {
    return NextResponse.json(
      {
        error:
          "Faltan campos obligatorios (idc, codcuentacobranza, tipo, moneda, fecha_promesa)",
      },
      { status: 400 },
    );
  }

  const tipoValido = TIPOS_PROMESA_PAGO.find((t) => t.codigo === tipo);
  if (!tipoValido) {
    return NextResponse.json(
      { error: "Tipo de promesa inválido" },
      { status: 400 },
    );
  }

  if (
    modalidad_pago &&
    !MODALIDADES_PAGO.find((m) => m.codigo === modalidad_pago)
  ) {
    return NextResponse.json(
      { error: "Modalidad de pago inválida" },
      { status: 400 },
    );
  }

  if (tipo_negociacion && !TIPOS_NEGOCIACION.includes(tipo_negociacion)) {
    return NextResponse.json(
      { error: "Tipo de negociación inválido" },
      { status: 400 },
    );
  }

  if (beneficio && !BENEFICIOS.includes(beneficio)) {
    return NextResponse.json({ error: "Beneficio inválido" }, { status: 400 });
  }

  if (status_pdp && !STATUS_PDP.includes(status_pdp)) {
    return NextResponse.json({ error: "Status PDP inválido" }, { status: 400 });
  }

  if (status_pago && !STATUS_PAGO.includes(status_pago)) {
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

  const cuenta = db
    .prepare(
      `
      SELECT
        idc,
        gestor,
        mtodeuda_sol,
        codmoneda,
        deudatotal_monedaorigen,
        deudavencida_monedaorigen
      FROM cuentas
      WHERE codcuentacobranza = ? AND activo = 1
    `,
    )
    .get(codcuentacobranza) as
    | {
      idc: string;
      gestor: string | null;
      mtodeuda_sol: number | null;
      codmoneda: string | null;
      deudatotal_monedaorigen: number | null;
      deudavencida_monedaorigen: number | null;
    }
    | undefined;

  if (!cuenta || cuenta.idc !== idc) {
    return NextResponse.json(
      { error: "La cuenta indicada no existe o no pertenece a este cliente" },
      { status: 400 },
    );
  }

  if (sesion.rol === "gestor" && cuenta.gestor !== sesion.gestor) {
    return NextResponse.json(
      { error: "No tienes acceso a esta cuenta" },
      { status: 403 },
    );
  }

  const ahora = new Date().toISOString();
  const modalidadValida = modalidad_pago
    ? MODALIDADES_PAGO.find((m) => m.codigo === modalidad_pago)
    : null;

  function esDolares(valor: string | null | undefined): boolean {
    const normalizado = String(valor ?? "")
      .trim()
      .toUpperCase();
    return (
      normalizado === "DOLARES" ||
      normalizado === "DÓLARES" ||
      normalizado === "USD"
    );
  }

  const monedaPromesaEsDolares = esDolares(moneda);
  const monedaCuentaEsDolares = esDolares(cuenta.codmoneda);

  const deudaTotalOrigen =
    cuenta.deudatotal_monedaorigen ?? cuenta.mtodeuda_sol ?? null;

  let montoDeudaTotal: number | null = deudaTotalOrigen;

  if (
    deudaTotalOrigen != null &&
    monedaCuentaEsDolares !== monedaPromesaEsDolares
  ) {
    montoDeudaTotal = monedaPromesaEsDolares
      ? Number((deudaTotalOrigen / TIPO_CAMBIO_REFERENCIAL).toFixed(2))
      : Number((deudaTotalOrigen * TIPO_CAMBIO_REFERENCIAL).toFixed(2));
  }

  const montoDolares =
    monto_prometido != null && !monedaPromesaEsDolares
      ? Number((monto_prometido / TIPO_CAMBIO_REFERENCIAL).toFixed(2))
      : null;

  const crearPromesaYGestion = db.transaction(() => {
    const gestionInsertada = db
      .prepare(
        `
        INSERT INTO gestiones (idc, codcuentacobranza, usuario_gestor_oficina, categoria, codigo_razon, segmentacion, fecha_hora, fecha_promesa, observacion)
        VALUES (@idc, @codcuentacobranza, @usuario_gestor_oficina, 'PDP', @codigo_razon, @segmentacion, @fecha_hora, @fecha_promesa, @observacion)
      `,
      )
      .run({
        idc,
        codcuentacobranza,
        usuario_gestor_oficina: sesion.nombreCompleto,
        codigo_razon: `${tipoValido.codigo} - ${tipoValido.descripcion}`,
        segmentacion: SEGMENTACION_FIJA_PDP,
        fecha_hora: ahora,
        fecha_promesa,
        observacion: observacion ?? null,
      });

    const promesaInsertada = db
      .prepare(
        `
        INSERT INTO promesas_pago (
          idc, codcuentacobranza, tipo, moneda, monto_deuda_total, monto_prometido, monto_dolares,
          modalidad_pago, tipo_negociacion, beneficio, status_pdp, status_pago, numero_cuotas_aprobadas,
          estudio, matriz, observacion, fecha_promesa, estado, usuario_gestor_oficina, fecha_hora, gestion_id
        ) VALUES (
          @idc, @codcuentacobranza, @tipo, @moneda, @monto_deuda_total, @monto_prometido, @monto_dolares,
          @modalidad_pago, @tipo_negociacion, @beneficio, @status_pdp, @status_pago, @numero_cuotas_aprobadas,
          @estudio, @matriz, @observacion, @fecha_promesa, 'vigente', @usuario_gestor_oficina, @fecha_hora, @gestion_id
        )
      `,
      )
      .run({
        idc,
        codcuentacobranza,
        tipo,
        moneda,
        monto_deuda_total: montoDeudaTotal,
        monto_prometido: monto_prometido ?? null,
        monto_dolares: montoDolares,
        modalidad_pago: modalidadValida
          ? `${modalidadValida.codigo} - ${modalidadValida.descripcion}`
          : null,
        tipo_negociacion: tipo_negociacion ?? null,
        beneficio: beneficio ?? null,
        status_pdp: status_pdp ?? null,
        status_pago: status_pago ?? "Pendiente",
        numero_cuotas_aprobadas: numero_cuotas_aprobadas ?? null,
        estudio: ESTUDIO_FIJO,
        matriz: MATRIZ_FIJA,
        observacion: observacion ?? null,
        fecha_promesa,
        usuario_gestor_oficina: sesion.nombreCompleto,
        fecha_hora: ahora,
        gestion_id: gestionInsertada.lastInsertRowid,
      });

    return promesaInsertada.lastInsertRowid;
  });

  const id = crearPromesaYGestion();

  return NextResponse.json({ ok: true, id });
}
