// app/api/telefonos/route.ts
// POST: agrega un teléfono manualmente para un cliente
// Se marca agregado_manualmente=1 para que un reimport del portafolio nunca lo borre.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import { clasificarTelefono } from "@/lib/mapeo-columnas";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { idc, phone } = body;

  if (!idc || !phone) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (idc, phone)" },
      { status: 400 },
    );
  }

  const numero = String(phone).trim();

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

  const ahora = new Date().toISOString();

  const resultado = db
    .prepare(
      `
      INSERT INTO telefonos (idc, phone, tipo_telefono, creado_por, editado_por, fecha_modificacion, agregado_manualmente, activo)
      VALUES (@idc, @phone, @tipo_telefono, @usuario, @usuario, @fecha, 1, 1)
    `,
    )
    .run({
      idc,
      phone: numero,
      tipo_telefono: clasificarTelefono(numero),
      usuario: sesion.nombreCompleto,
      fecha: ahora,
    });

  return NextResponse.json({ ok: true, id: resultado.lastInsertRowid });
}
