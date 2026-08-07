// app/api/admin/pdps-buscar/route.ts
// Busca promesas de pago por nombre de cliente o IDC. Ampliado con
// los campos del formato "BASE"

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const ROLES_CON_ACCESO = ["administrador", "supervisor"];

type FilaResultado = {
  id: number;
  idc: string;
  cliente: string | null;
  gestor: string;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  modalidad_pago: string | null;
  observacion: string | null;
  estado: string;
  fecha_promesa: string;
  fecha_hora: string;
  tipo_negociacion: string | null;
  beneficio: string | null;
  status_pdp: string | null;
  status_pago: string | null;
  numero_cuotas_aprobadas: number | null;
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
         pp.id,
         pp.idc,
         (SELECT cliente FROM cuentas c WHERE c.idc = pp.idc AND c.activo = 1 LIMIT 1) as cliente,
         pp.usuario_gestor_oficina as gestor,
         pp.tipo,
         pp.moneda,
         pp.monto_deuda_total,
         pp.monto_prometido,
         pp.modalidad_pago,
         pp.observacion,
         pp.estado,
         pp.fecha_promesa,
         pp.fecha_hora,
         pp.tipo_negociacion,
         pp.beneficio,
         pp.status_pdp,
         pp.status_pago,
         pp.numero_cuotas_aprobadas
       FROM promesas_pago pp
       WHERE pp.idc LIKE @patron
          OR (SELECT cliente FROM cuentas c WHERE c.idc = pp.idc AND c.activo = 1 LIMIT 1) LIKE @patron
       ORDER BY pp.fecha_hora DESC
       LIMIT 50`,
    )
    .all({ patron }) as FilaResultado[];

  return NextResponse.json({ resultados });
}
