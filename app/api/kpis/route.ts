// app/api/kpis/route.ts
// Calcula indicadores diarios agrupados por gestor y funcionario.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type FilaResumen = {
  gestor: string;
  funcionario: string;
  gestionesRealizadas: number;
  clientesDistintosGestionados: number;
  gestionesConContactoDirecto: number;
};

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get("fecha");
  const gestorFiltro = request.nextUrl.searchParams.get("gestor");

  const fechaObjetivo = fecha ?? new Date().toISOString().slice(0, 10);

  let condicionGestor = "";
  const parametros: any[] = [`${fechaObjetivo}%`];

  if (gestorFiltro) {
    condicionGestor = "AND g.usuario_gestor_oficina = ?";
    parametros.push(gestorFiltro);
  }

  const filas = db
    .prepare(
      `SELECT
         g.usuario_gestor_oficina as gestor,
         c.funcionario as funcionario,
         COUNT(*) as gestionesRealizadas,
         COUNT(DISTINCT g.idc) as clientesDistintosGestionados,
         SUM(CASE WHEN g.categoria = 'TAT' THEN 1 ELSE 0 END) as gestionesConContactoDirecto
       FROM gestiones g
       JOIN cuentas c ON c.codcuentacobranza = COALESCE(
         g.codcuentacobranza,
         (SELECT codcuentacobranza FROM cuentas cc WHERE cc.idc = g.idc AND cc.activo = 1 ORDER BY cc.mtodeuda_sol DESC LIMIT 1)
       )
       WHERE g.fecha_hora LIKE ? ${condicionGestor}
       GROUP BY g.usuario_gestor_oficina, c.funcionario`,
    )
    .all(...parametros) as FilaResumen[];

  const resultado = filas.map((f) => ({
    fecha: fechaObjetivo,
    gestor: f.gestor,
    funcionario: f.funcionario,
    gestionesRealizadas: f.gestionesRealizadas,
    clientesDistintosGestionados: f.clientesDistintosGestionados,
    gestionesConContactoDirecto: f.gestionesConContactoDirecto,
    intensidadDiaria: Number(
      (f.gestionesRealizadas / f.clientesDistintosGestionados).toFixed(2),
    ),
    contactabilidadDiariaPorcentaje: Number(
      ((f.gestionesConContactoDirecto / f.gestionesRealizadas) * 100).toFixed(
        1,
      ),
    ),
  }));

  return NextResponse.json({ fecha: fechaObjetivo, resultados: resultado });
}
