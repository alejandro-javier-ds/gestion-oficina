// app/api/direcciones/[id]/route.ts
//
// PATCH:
// Edita una dirección existente o la desactiva.
//
// Funciona tanto para:
// fuente = 'manual'
// fuente = 'portafolio'

import { NextRequest, NextResponse } from "next/server";

import { consultarUno, ejecutar } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_EDITAR = ["gestor", "supervisor"];

const TIPOS_VALIDOS = ["Domicilio", "Comercial", "Otro"];

type DireccionExistente = {
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

  const { direccion, distrito, provincia, departamento, tipo, activo } = body;

  const registro = await consultarUno<DireccionExistente>(
    `
      SELECT
        idc
      FROM direcciones
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  if (!registro) {
    return NextResponse.json(
      {
        error: "Dirección no encontrada",
      },
      {
        status: 404,
      },
    );
  }

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      {
        error: "Tipo de dirección inválido",
      },
      {
        status: 400,
      },
    );
  }

  await ejecutar(
    `
      UPDATE direcciones
      SET
        direccion =
          COALESCE(
            $1,
            direccion
          ),

        distrito =
          COALESCE(
            $2,
            distrito
          ),

        provincia =
          COALESCE(
            $3,
            provincia
          ),

        departamento =
          COALESCE(
            $4,
            departamento
          ),

        tipo =
          COALESCE(
            $5,
            tipo
          ),

        activo =
          COALESCE(
            $6,
            activo
          ),

        editado_por = $7,

        fecha_modificacion = $8

      WHERE id = $9
    `,
    [
      direccion ?? null,
      distrito ?? null,
      provincia ?? null,
      departamento ?? null,
      tipo ?? null,

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
