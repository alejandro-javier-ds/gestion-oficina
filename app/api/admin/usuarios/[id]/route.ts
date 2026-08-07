// app/api/admin/usuarios/[id]/route.ts
// DELETE: elimina un usuario por su ID. No permite que un
// administrador se elimine a sí mismo (evita quedarse sin acceso
// por accidente).

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const idNumero = Number(id);

  if (isNaN(idNumero)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  if (idNumero === sesion.userId) {
    return NextResponse.json(
      {
        error:
          "No puedes eliminar tu propia cuenta mientras tienes sesión activa",
      },
      { status: 400 },
    );
  }

  const resultado = db
    .prepare("DELETE FROM usuarios WHERE id = ?")
    .run(idNumero);

  if (resultado.changes === 0) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
