// app/api/gestiones/route.ts
// gestión nueva. telefono — el número al que se llamó
// (celular/fijo, portafolio + agregados a mano).

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import { SEGMENTACIONES } from "@/lib/catalogo-tipificacion";

const ROLES_QUE_PUEDEN_REGISTRAR = ["gestor", "supervisor"];

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const idc = request.nextUrl.searchParams.get("idc");

  if (!idc) {
    return NextResponse.json(
      { error: "Falta el parámetro idc" },
      { status: 400 },
    );
  }

  if (sesion.rol === "gestor") {
    const perteneceAlGestor = db
      .prepare("SELECT 1 FROM cuentas WHERE idc = ? AND gestor = ? LIMIT 1")
      .get(idc, sesion.gestor);

    if (!perteneceAlGestor) {
      return NextResponse.json(
        { error: "No tienes acceso a este cliente" },
        { status: 403 },
      );
    }
  }

  const categoria = request.nextUrl.searchParams.get("categoria");
  const desde = request.nextUrl.searchParams.get("desde");
  const hasta = request.nextUrl.searchParams.get("hasta");
  const orden =
    request.nextUrl.searchParams.get("orden") === "antiguas" ? "ASC" : "DESC";

  const condiciones: string[] = ["idc = ?"];
  const parametros: any[] = [idc];

  if (categoria && categoria !== "TODAS") {
    condiciones.push("categoria = ?");
    parametros.push(categoria);
  }
  if (desde) {
    condiciones.push("date(fecha_hora) >= ?");
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push("date(fecha_hora) <= ?");
    parametros.push(hasta);
  }

  const gestiones = db
    .prepare(
      `SELECT * FROM gestiones WHERE ${condiciones.join(" AND ")} ORDER BY fecha_hora ${orden}`,
    )
    .all(...parametros);

  return NextResponse.json({ gestiones });
}

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_REGISTRAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para registrar gestiones." },
      { status: 403 },
    );
  }

  const body = await request.json();

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
    return NextResponse.json({ error: "Falta el campo idc" }, { status: 400 });
  }

  if (!segmentacion || !SEGMENTACIONES.includes(segmentacion)) {
    return NextResponse.json(
      {
        error:
          "La Segmentación es obligatoria y debe ser una de las opciones válidas.",
      },
      { status: 400 },
    );
  }

  if (!telefono || typeof telefono !== "string" || telefono.trim() === "") {
    return NextResponse.json(
      { error: "El teléfono al que se llamó es obligatorio." },
      { status: 400 },
    );
  }

  if (
    monto_pagado != null &&
    (typeof monto_pagado !== "number" || monto_pagado < 0)
  ) {
    return NextResponse.json(
      { error: "El monto pagado debe ser un número positivo" },
      { status: 400 },
    );
  }

  if (
    monto_pagado != null &&
    moneda_monto_pagado != null &&
    !["Soles", "Dolares", "Dólares"].includes(moneda_monto_pagado)
  ) {
    return NextResponse.json(
      { error: "Moneda del monto pagado inválida" },
      { status: 400 },
    );
  }

  const clienteExiste = db
    .prepare("SELECT gestor FROM cuentas WHERE idc = ? AND activo = 1 LIMIT 1")
    .get(idc) as { gestor: string | null } | undefined;

  if (!clienteExiste) {
    return NextResponse.json(
      { error: "El cliente no existe o no tiene cuentas activas" },
      { status: 404 },
    );
  }

  if (sesion.rol === "gestor" && clienteExiste.gestor !== sesion.gestor) {
    return NextResponse.json(
      { error: "No tienes acceso a este cliente" },
      { status: 403 },
    );
  }

  if (codcuentacobranza) {
    const cuentaPerteneceAlCliente = db
      .prepare("SELECT 1 FROM cuentas WHERE codcuentacobranza = ? AND idc = ?")
      .get(codcuentacobranza, idc);

    if (!cuentaPerteneceAlCliente) {
      return NextResponse.json(
        { error: "La cuenta indicada no pertenece a este cliente" },
        { status: 400 },
      );
    }
  }

  const ahora = new Date().toISOString();

  const insertar = db.prepare(`
    INSERT INTO gestiones (
      idc, codcuentacobranza, usuario_gestor_oficina, categoria, codigo_razon, segmentacion, telefono,
      fecha_hora, monto_compromiso, monto_pagado, moneda_monto_pagado, fecha_promesa, observacion
    ) VALUES (
      @idc, @codcuentacobranza, @usuario_gestor_oficina, @categoria, @codigo_razon, @segmentacion, @telefono,
      @fecha_hora, @monto_compromiso, @monto_pagado, @moneda_monto_pagado, @fecha_promesa, @observacion
    )
  `);

  const resultado = insertar.run({
    idc,
    codcuentacobranza: codcuentacobranza ?? null,
    usuario_gestor_oficina: sesion.nombreCompleto,
    categoria: categoria ?? null,
    codigo_razon: codigo_razon ?? null,
    segmentacion,
    telefono: telefono.trim(),
    fecha_hora: ahora,
    monto_compromiso: monto_compromiso ?? null,
    monto_pagado: monto_pagado ?? null,
    moneda_monto_pagado:
      monto_pagado != null ? (moneda_monto_pagado ?? "Soles") : null,
    fecha_promesa: fecha_promesa ?? null,
    observacion: observacion ?? null,
  });

  return NextResponse.json({ ok: true, id: resultado.lastInsertRowid });
}
