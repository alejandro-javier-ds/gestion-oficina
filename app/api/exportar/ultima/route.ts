// app/api/exportar/ultima/route.ts
//
// Trae el registro de la última
// exportación realizada.

import { NextResponse } from "next/server";

import { consultarUno } from "@/lib/postgres";
import { requerirAccesoApi } from "@/lib/api-acceso";

const ROLES_EXPORTACION = ["administrador", "supervisor", "abogado"] as const;

export const runtime = "nodejs";

type UltimaExportacion = {
  fecha_hora: string;
  usuario: string;
};

export async function GET() {
  const acceso = await requerirAccesoApi(ROLES_EXPORTACION);
  if (!acceso.ok) return acceso.respuesta;
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
