// app/api/direcciones/[id]/route.ts
// PATCH: edita una dirección existente o la desactiva. Funciona
// tanto para direcciones fuente='manual' como fuente='portafolio'

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];
const TIPOS_VALIDOS = ["Domicilio", "Comercial", "Otro"];

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
  const { direccion, distrito, provincia, departamento, tipo, activo } = body;

  const registro = db
    .prepare("SELECT idc FROM direcciones WHERE id = ?")
    .get(id) as { idc: string } | undefined;

  if (!registro) {
    return NextResponse.json(
      { error: "Dirección no encontrada" },
      { status: 404 },
    );
  }

  if (sesion.rol === "gestor") {
    const perteneceAlGestor = db
      .prepare("SELECT 1 FROM cuentas WHERE idc = ? AND gestor = ? LIMIT 1")
      .get(registro.idc, sesion.gestor);

    if (!perteneceAlGestor) {
      return NextResponse.json(
        { error: "No tienes acceso a este cliente" },
        { status: 403 },
      );
    }
  }

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo de dirección inválido" },
      { status: 400 },
    );
  }

  db.prepare(
    `
    UPDATE direcciones SET
      direccion = COALESCE(@direccion, direccion),
      distrito = COALESCE(@distrito, distrito),
      provincia = COALESCE(@provincia, provincia),
      departamento = COALESCE(@departamento, departamento),
      tipo = COALESCE(@tipo, tipo),
      activo = COALESCE(@activo, activo),
      editado_por = @editado_por,
      fecha_modificacion = @fecha_modificacion
    WHERE id = @id
  `,
  ).run({
    id,
    direccion: direccion ?? null,
    distrito: distrito ?? null,
    provincia: provincia ?? null,
    departamento: departamento ?? null,
    tipo: tipo ?? null,
    activo: activo != null ? (activo ? 1 : 0) : null,
    editado_por: sesion.nombreCompleto,
    fecha_modificacion: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
