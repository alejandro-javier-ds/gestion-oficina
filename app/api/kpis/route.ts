// app/api/kpis/route.ts
//
// Calcula indicadores diarios agrupados
// por gestor y funcionario.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

export const runtime = "nodejs";

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

  let filas: FilaResumen[];

  if (gestorFiltro) {
    filas = await consultarFilas<FilaResumen>(
      `
          SELECT
            g.usuario_gestor_oficina
              AS gestor,

            c.funcionario
              AS funcionario,

            COUNT(*)::int
              AS "gestionesRealizadas",

            COUNT(
              DISTINCT g.idc
            )::int
              AS "clientesDistintosGestionados",

            SUM(
              CASE
                WHEN g.categoria = 'TAT'
                  THEN 1
                ELSE 0
              END
            )::int
              AS "gestionesConContactoDirecto"

          FROM gestiones g

          JOIN cuentas c
            ON c.codcuentacobranza =
              COALESCE(
                g.codcuentacobranza,

                (
                  SELECT
                    cc.codcuentacobranza
                  FROM cuentas cc
                  WHERE cc.idc = g.idc
                    AND cc.activo = 1
                  ORDER BY
                    cc.mtodeuda_sol DESC
                  LIMIT 1
                )
              )

          WHERE g.fecha_hora LIKE $1
            AND g.usuario_gestor_oficina = $2

          GROUP BY
            g.usuario_gestor_oficina,
            c.funcionario
        `,
      [`${fechaObjetivo}%`, gestorFiltro],
    );
  } else {
    filas = await consultarFilas<FilaResumen>(
      `
          SELECT
            g.usuario_gestor_oficina
              AS gestor,

            c.funcionario
              AS funcionario,

            COUNT(*)::int
              AS "gestionesRealizadas",

            COUNT(
              DISTINCT g.idc
            )::int
              AS "clientesDistintosGestionados",

            SUM(
              CASE
                WHEN g.categoria = 'TAT'
                  THEN 1
                ELSE 0
              END
            )::int
              AS "gestionesConContactoDirecto"

          FROM gestiones g

          JOIN cuentas c
            ON c.codcuentacobranza =
              COALESCE(
                g.codcuentacobranza,

                (
                  SELECT
                    cc.codcuentacobranza
                  FROM cuentas cc
                  WHERE cc.idc = g.idc
                    AND cc.activo = 1
                  ORDER BY
                    cc.mtodeuda_sol DESC
                  LIMIT 1
                )
              )

          WHERE g.fecha_hora LIKE $1

          GROUP BY
            g.usuario_gestor_oficina,
            c.funcionario
        `,
      [`${fechaObjetivo}%`],
    );
  }

  const resultado = filas.map((fila) => ({
    fecha: fechaObjetivo,

    gestor: fila.gestor,

    funcionario: fila.funcionario,

    gestionesRealizadas: fila.gestionesRealizadas,

    clientesDistintosGestionados: fila.clientesDistintosGestionados,

    gestionesConContactoDirecto: fila.gestionesConContactoDirecto,

    intensidadDiaria:
      fila.clientesDistintosGestionados > 0
        ? Number(
          (
            fila.gestionesRealizadas / fila.clientesDistintosGestionados
          ).toFixed(2),
        )
        : 0,

    contactabilidadDiariaPorcentaje:
      fila.gestionesRealizadas > 0
        ? Number(
          (
            (fila.gestionesConContactoDirecto / fila.gestionesRealizadas) *
            100
          ).toFixed(1),
        )
        : 0,
  }));

  return NextResponse.json({
    fecha: fechaObjetivo,

    resultados: resultado,
  });
}
