// app/api/telefonos/[id]/route.ts
//
// PATCH:
// Edita un teléfono existente.
//
// Permite:
// - cambiar tipo_telefono
// - activar/desactivar
//
// El teléfono NO se elimina físicamente.

import { NextRequest, NextResponse } from "next/server";

import { consultarUno, ejecutar } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];

const TIPOS_VALIDOS = ["celular", "fijo", "revisar"];

type TelefonoExistente = {
  idc: string;
};

export async function PATCH(
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

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para esto.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  const body = await request.json();

  const { tipo_telefono, activo } = body;

  const telefono = await consultarUno<TelefonoExistente>(
    `
      SELECT
        idc
      FROM telefonos
      WHERE id_phone = $1
      LIMIT 1
    `,
    [id],
  );

  if (!telefono) {
    return NextResponse.json(
      {
        error: "Teléfono no encontrado",
      },
      {
        status: 404,
      },
    );
  }

  if (tipo_telefono && !TIPOS_VALIDOS.includes(tipo_telefono)) {
    return NextResponse.json(
      {
        error: "Tipo de teléfono inválido",
      },
      {
        status: 400,
      },
    );
  }

  await ejecutar(
    `
      UPDATE telefonos
      SET
        tipo_telefono =
          COALESCE(
            $1,
            tipo_telefono
          ),

        activo =
          COALESCE(
            $2,
            activo
          ),

        editado_por =
          $3,

        fecha_modificacion =
          $4

      WHERE id_phone = $5
    `,
    [
      tipo_telefono ?? null,

      activo != null ? (activo ? 1 : 0) : null,

      sesion.nombreCompleto,

      new Date().toISOString(),

      id,
    ],
  );

  return NextResponse.json({
    ok: true,
  });
}
