// app/api/admin/gestiones-buscar/route.ts
// Busca gestiones por nombre de cliente o IDC, sin filtrar por gestor

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const ROLES_CON_ACCESO = ["administrador", "supervisor"];

type FilaResultado = {
  id: number;
  idc: string;
  cliente: string | null;
  codcuentacobranza: string | null;
  usuario_gestor_oficina: string;
  categoria: string | null;
  codigo_razon: string | null;
  fecha_hora: string;
  monto_pagado: number | null;
  observacion: string | null;
};

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_CON_ACCESO.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene acceso a esta búsqueda." },
      { status: 403 },
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ resultados: [] });
  }

  const patron = `%${q}%`;

  const resultados = db
    .prepare(
      `SELECT
         g.id,
         g.idc,
         (SELECT cliente FROM cuentas cc WHERE cc.idc = g.idc AND cc.activo = 1 LIMIT 1) as cliente,
         g.codcuentacobranza,
         g.usuario_gestor_oficina,
         g.categoria,
         g.codigo_razon,
         g.fecha_hora,
         g.monto_pagado,
         g.observacion
       FROM gestiones g
       WHERE g.idc LIKE @patron
          OR (SELECT cliente FROM cuentas cc WHERE cc.idc = g.idc AND cc.activo = 1 LIMIT 1) LIKE @patron
       ORDER BY g.fecha_hora DESC
       LIMIT 50`,
    )
    .all({ patron }) as FilaResultado[];

  return NextResponse.json({ resultados });
}
