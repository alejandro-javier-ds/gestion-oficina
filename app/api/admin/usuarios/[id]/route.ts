// app/api/admin/usuarios/[id]/route.ts
//
// DELETE: elimina un usuario por ID.
//
// No permite que el usuario con la sesión
// activa elimine su propia cuenta.

import { NextRequest, NextResponse } from "next/server";

import { consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

type UsuarioEliminado = {
  id: number;
};

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

  const { id } = await params;

  const idNumero = Number(id);

  if (Number.isNaN(idNumero)) {
    return NextResponse.json(
      {
        error: "ID inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (idNumero === sesion.userId) {
    return NextResponse.json(
      {
        error:
          "No puedes eliminar tu propia cuenta mientras tienes sesión activa",
      },
      {
        status: 400,
      },
    );
  }

  const eliminado = await consultarUno<UsuarioEliminado>(
    `
        DELETE FROM usuarios
        WHERE id = $1
        RETURNING id::int AS id
      `,
    [idNumero],
  );

  if (!eliminado) {
    return NextResponse.json(
      {
        error: "Usuario no encontrado",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
