// app/api/exportar/vista-previa/route.ts
// Trae una muestra de gestiones para la vista previa del Excel.

import { NextResponse } from "next/server";
import db from "@/lib/db";

type FilaCompleta = {
  fecha_hora: string;
  gestor: string;
  funcionario: string | null;
  cliente: string;
  idc: string;
  telefono: string | null;
  segmentacion: string | null;
  categoria: string | null;
  codigo_razon: string | null;
  monto_pagado: number | null;
  moneda_monto_pagado: string | null;
  observacion: string | null;
  mtodeuda_sol: number | null;
  diasmora: number | null;
  rango_mora: string | null;
  descproducto: string | null;
  estado_cartera: string | null;
  etapa_procesal: string | null;
  prioridad: string | null;
  direccion: string | null;
  distrito: string | null;
  departamento: string | null;
  router: string | null;
  nivel_riesgo: string | null;
};

export async function GET() {
  const muestra = db
    .prepare(
      `SELECT
         g.fecha_hora,
         g.usuario_gestor_oficina as gestor,
         c.funcionario,
         c.cliente,
         g.idc,
         g.telefono,
         g.segmentacion,
         g.categoria,
         g.codigo_razon,
         g.monto_pagado,
         g.moneda_monto_pagado,
         g.observacion,
         c.mtodeuda_sol,
         c.diasmora,
         c.rango_mora,
         c.descproducto,
         c.estado_cartera,
         c.etapa_procesal,
         c.prioridad,
         c.direccion,
         c.distrito,
         c.departamento,
         c.router,
         c.nivel_riesgo
       FROM gestiones g
       JOIN cuentas c ON c.codcuentacobranza = COALESCE(
         g.codcuentacobranza,
         (SELECT codcuentacobranza FROM cuentas cc WHERE cc.idc = g.idc AND cc.activo = 1 ORDER BY cc.mtodeuda_sol DESC LIMIT 1)
       )
       WHERE (g.categoria IS NULL OR g.categoria != 'PDP')
       ORDER BY g.fecha_hora DESC
       LIMIT 15`,
    )
    .all() as FilaCompleta[];

  const totalGestiones = db
    .prepare(
      `SELECT COUNT(*) as total FROM gestiones WHERE (categoria IS NULL OR categoria != 'PDP')`,
    )
    .get() as { total: number };

  const gestionesHoy = db
    .prepare(
      `SELECT COUNT(*) as total FROM gestiones WHERE date(fecha_hora) = date('now') AND (categoria IS NULL OR categoria != 'PDP')`,
    )
    .get() as { total: number };

  return NextResponse.json({
    muestra,
    totalGestiones: totalGestiones.total,
    gestionesHoy: gestionesHoy.total,
  });
}
