// app/api/cuenta/[codigo]/route.ts
//
// Trae una cuenta puntual, las demás cuentas activas
// del mismo IDC y sus teléfonos.
//
// Todos los usuarios autenticados pueden consultar
// cuentas de cualquier cliente, independientemente
// del gestor asignado.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { Cuenta } from "@/lib/types";

export const runtime = "nodejs";

type TelefonoCuenta = {
  id_phone: number;
  idc: string;
  cic: string | null;
  phone: string;
  tipo_telefono: string;
  qtty_phone_ranking: number | null;
  creado_por: string | null;
  editado_por: string | null;
  fecha_modificacion: string | null;
  agregado_manualmente: number;
  activo: number;
};

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      codigo: string;
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

  const { codigo } = await params;

  const cuenta = await consultarUno<Cuenta>(
    `
      SELECT *
      FROM cuentas
      WHERE codcuentacobranza = $1
    `,
    [codigo],
  );

  if (!cuenta) {
    return NextResponse.json(
      {
        error: "Cuenta no encontrada",
      },
      {
        status: 404,
      },
    );
  }

  const otrasCuentas = await consultarFilas<Cuenta>(
    `
      SELECT *
      FROM cuentas
      WHERE idc = $1
        AND codcuentacobranza <> $2
        AND activo = 1
    `,
    [cuenta.idc, codigo],
  );

  const telefonos = await consultarFilas<TelefonoCuenta>(
    `
      SELECT
        id_phone::int AS id_phone,
        idc,
        cic,
        phone,
        tipo_telefono,
        qtty_phone_ranking,
        creado_por,
        editado_por,
        fecha_modificacion,
        agregado_manualmente,
        activo
      FROM telefonos
      WHERE idc = $1
        AND activo = 1
      ORDER BY
        CASE tipo_telefono
          WHEN 'celular' THEN 0
          WHEN 'fijo' THEN 1
          ELSE 2
        END,
        qtty_phone_ranking DESC
    `,
    [cuenta.idc],
  );

  const cic = telefonos.find((telefono) => telefono.cic)?.cic ?? null;

  return NextResponse.json({
    cuenta,
    otrasCuentas,
    telefonos,
    cic,
  });
}
