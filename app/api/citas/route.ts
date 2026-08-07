// app/api/citas/route.ts
// GET: lista las citas de un cliente (por idc), más recientes
// primero. POST: crea una cita nueva — CIH (mismo día, fecha
// automática) o CIT (otro día, fecha elegida por el gestor).

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const ROLES_QUE_PUEDEN_REGISTRAR = ["gestor", "supervisor"];
const TIPOS_VALIDOS = ["CIH", "CIT"];

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

  const citas = db
    .prepare("SELECT * FROM citas WHERE idc = ? ORDER BY fecha_cita DESC")
    .all(idc);

  return NextResponse.json({ citas });
}

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_REGISTRAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para registrar citas." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { idc, tipo, fecha_cita, observacion } = body;

  if (!idc || !tipo) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (idc, tipo)" },
      { status: 400 },
    );
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo de cita inválido" },
      { status: 400 },
    );
  }

  let fechaFinal: string;
  if (tipo === "CIH") {
    fechaFinal = new Date().toISOString().slice(0, 10);
  } else {
    if (!fecha_cita) {
      return NextResponse.json(
        { error: "CIT requiere una fecha de cita" },
        { status: 400 },
      );
    }
    fechaFinal = fecha_cita;
  }

  const cliente = db
    .prepare("SELECT gestor FROM cuentas WHERE idc = ? AND activo = 1 LIMIT 1")
    .get(idc) as { gestor: string | null } | undefined;

  if (!cliente) {
    return NextResponse.json(
      { error: "El cliente no existe o no tiene cuentas activas" },
      { status: 404 },
    );
  }

  if (sesion.rol === "gestor" && cliente.gestor !== sesion.gestor) {
    return NextResponse.json(
      { error: "No tienes acceso a este cliente" },
      { status: 403 },
    );
  }

  const ahora = new Date().toISOString();

  const resultado = db
    .prepare(
      `
      INSERT INTO citas (idc, tipo, fecha_cita, observacion, estado, usuario_gestor_oficina, fecha_hora)
      VALUES (@idc, @tipo, @fecha_cita, @observacion, 'pendiente', @usuario_gestor_oficina, @fecha_hora)
    `,
    )
    .run({
      idc,
      tipo,
      fecha_cita: fechaFinal,
      observacion: observacion ?? null,
      usuario_gestor_oficina: sesion.nombreCompleto,
      fecha_hora: ahora,
    });

  return NextResponse.json({ ok: true, id: resultado.lastInsertRowid });
}
