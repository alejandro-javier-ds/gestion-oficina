// app/api/exportar/ultima/route.ts
//
// Trae el registro de la última
// exportación realizada.

import { NextResponse } from "next/server";

import { consultarUno } from "@/lib/postgres";

export const runtime = "nodejs";

type UltimaExportacion = {
  fecha_hora: string;
  usuario: string;
};

export async function GET() {
  const ultima = await consultarUno<UltimaExportacion>(
    `
        SELECT
          fecha_hora,
          usuario

        FROM exportaciones

        ORDER BY
          fecha_hora DESC

        LIMIT 1
      `,
  );

  return NextResponse.json({
    ultima: ultima ?? null,
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
