// app/api/admin/portafolio/historial/route.ts
//
// GET: devuelve las últimas importaciones
// de portafolio registradas.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

export const runtime = "nodejs";

type ImportRegistrado = {
  id: number;
  nombre_archivo: string;
  fecha_import: string;
  cuentas_nuevas: number;
  cuentas_actualizadas: number;
  cuentas_dadas_de_baja: number;
};

export async function GET(request: NextRequest) {
  const limiteRaw = Number(request.nextUrl.searchParams.get("limite") ?? "5");

  const limite =
    Number.isFinite(limiteRaw) && limiteRaw > 0
      ? Math.min(Math.trunc(limiteRaw), 100)
      : 5;

  const historial = await consultarFilas<ImportRegistrado>(
    `
        SELECT
          id::int AS id,
          nombre_archivo,
          fecha_import,
          cuentas_nuevas::int AS cuentas_nuevas,
          cuentas_actualizadas::int AS cuentas_actualizadas,
          cuentas_dadas_de_baja::int AS cuentas_dadas_de_baja

        FROM imports

        ORDER BY
          fecha_import DESC

        LIMIT $1
      `,
    [limite],
  );

  return NextResponse.json({
    historial,
  });
}
