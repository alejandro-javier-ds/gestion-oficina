// app/api/direcciones/route.ts
// POST: agrega una dirección manual para un cliente — se marca
// fuente='manual', así ningún reimport del portafolio la va a
// tocar ni a borrar.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];
const TIPOS_VALIDOS = ["Domicilio", "Comercial", "Otro"];

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
  const { idc, direccion, distrito, provincia, departamento, tipo } = body;

  if (!idc || !direccion) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (idc, direccion)" },
      { status: 400 },
    );
  }

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo de dirección inválido" },
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

  const ahora = new Date().toISOString();

  const resultado = db
    .prepare(
      `
      INSERT INTO direcciones (idc, direccion, distrito, provincia, departamento, tipo, fuente, creado_por, editado_por, fecha_modificacion, activo)
      VALUES (@idc, @direccion, @distrito, @provincia, @departamento, @tipo, 'manual', @usuario, @usuario, @fecha, 1)
    `,
    )
    .run({
      idc,
      direccion,
      distrito: distrito ?? null,
      provincia: provincia ?? null,
      departamento: departamento ?? null,
      tipo: tipo ?? "Domicilio",
      usuario: sesion.nombreCompleto,
      fecha: ahora,
    });

  return NextResponse.json({ ok: true, id: resultado.lastInsertRowid });
}
