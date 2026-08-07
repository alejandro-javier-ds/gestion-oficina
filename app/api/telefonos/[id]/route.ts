// app/api/telefonos/[id]/route.ts
// PATCH: edita un teléfono existente — cambia su tipo (celular/fijo/
// revisar) o lo desactiva (activo=0, no se borra, por si hace falta
// recuperarlo).

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];
const TIPOS_VALIDOS = ["celular", "fijo", "revisar"];

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
  const { tipo_telefono, activo } = body;

  const telefono = db
    .prepare("SELECT idc FROM telefonos WHERE id_phone = ?")
    .get(id) as { idc: string } | undefined;

  if (!telefono) {
    return NextResponse.json(
      { error: "Teléfono no encontrado" },
      { status: 404 },
    );
  }

  if (sesion.rol === "gestor") {
    const perteneceAlGestor = db
      .prepare("SELECT 1 FROM cuentas WHERE idc = ? AND gestor = ? LIMIT 1")
      .get(telefono.idc, sesion.gestor);

    if (!perteneceAlGestor) {
      return NextResponse.json(
        { error: "No tienes acceso a este cliente" },
        { status: 403 },
      );
    }
  }

  if (tipo_telefono && !TIPOS_VALIDOS.includes(tipo_telefono)) {
    return NextResponse.json(
      { error: "Tipo de teléfono inválido" },
      { status: 400 },
    );
  }

  db.prepare(
    `
    UPDATE telefonos SET
      tipo_telefono = COALESCE(@tipo_telefono, tipo_telefono),
      activo = COALESCE(@activo, activo),
      editado_por = @editado_por,
      fecha_modificacion = @fecha_modificacion
    WHERE id_phone = @id
  `,
  ).run({
    id,
    tipo_telefono: tipo_telefono ?? null,
    activo: activo != null ? (activo ? 1 : 0) : null,
    editado_por: sesion.nombreCompleto,
    fecha_modificacion: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
