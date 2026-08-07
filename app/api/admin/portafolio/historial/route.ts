// app/api/admin/portafolio/historial/route.ts
// GET: trae las últimas N importaciones de portafolio registradas
// en la tabla `imports`, para mostrar "Último portafolio importado"
// y el historial reciente en la pantalla de Subir Portafolio.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type ImportRegistrado = {
  id: number;
  nombre_archivo: string;
  fecha_import: string;
  cuentas_nuevas: number;
  cuentas_actualizadas: number;
  cuentas_dadas_de_baja: number;
};

export async function GET(request: NextRequest) {
  const limite = Number(request.nextUrl.searchParams.get("limite") ?? "5");

  const historial = db
    .prepare(
      `SELECT id, nombre_archivo, fecha_import, cuentas_nuevas, cuentas_actualizadas, cuentas_dadas_de_baja
       FROM imports
       ORDER BY fecha_import DESC
       LIMIT ?`,
    )
    .all(limite) as ImportRegistrado[];

  return NextResponse.json({ historial });
}
