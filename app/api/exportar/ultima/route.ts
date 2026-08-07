// app/api/exportar/ultima/route.ts
// trae el registro de la última exportación realizada

import { NextResponse } from "next/server";
import db from "@/lib/db";

type UltimaExportacion = {
  fecha_hora: string;
  usuario: string;
};

export async function GET() {
  const ultima = db
    .prepare(
      "SELECT fecha_hora, usuario FROM exportaciones ORDER BY fecha_hora DESC LIMIT 1",
    )
    .get() as UltimaExportacion | undefined;

  return NextResponse.json({ ultima: ultima ?? null });
}
