// app/api/dashboard/indicadores/route.ts
//
// Datos para la sección Indicadores del Dashboard.
//
// - Cobertura = clientes distintos tocados / clientes de cartera
// - Contactabilidad = clientes distintos con al menos 1 TAT / cartera
// - Intensidad = total de gestiones con repetición / cartera

import { NextRequest, NextResponse } from "next/server";
import { consultarFilas, consultarUno } from "@/lib/postgres";
import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const META_INTENSIDAD = 15;
const META_COBERTURA = 100;

type FilaResumenDiarioRaw = {
  fecha: string;
  gestor: string;
  funcionario: string | null;
  gestionesRealizadas: number;
  clientesDistintosConTat: number;
  promesasCreadas: number;
  promesasCumplidas: number;
  citasAgendadas: number;
};

type FilaPorGestor = {
  gestor: string;
  gestionesRealizadas: number;
  clientesDistintosConTat: number;
};

type FilaPorDia = {
  fecha: string;
  gestiones: number;
};

type FilaCarteraPorGestor = {
  gestor: string;
  total: number;
};

type KpisRango = {
  totalGestiones: number;
  clientesDistintos: number;
};

type Total = {
  total: number;
};

type PromesasPorEstado = {
  vigentes: number;
  cumplidas: number;
  rotas: number;
};

const CONDICION_CARTERA = `
  activo = 1
  AND UPPER(TRIM(estado_cartera)) IN ('ACTIVA', 'CASTIGO')
`;

const JOIN_CUENTA_REPRESENTATIVA = `
  JOIN cuentas c
    ON c.codcuentacobranza = COALESCE(
      g.codcuentacobranza,
      (
        SELECT cc.codcuentacobranza
        FROM cuentas cc
        WHERE cc.idc = g.idc
          AND cc.activo = 1
          AND UPPER(TRIM(cc.estado_cartera)) IN ('ACTIVA', 'CASTIGO')
        ORDER BY cc.mtodeuda_sol DESC
        LIMIT 1
      )
    )
`;

function rangoMesActual(): {
  desde: string;
  hasta: string;
} {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
  };
}

function inicioDeMes(fechaISO: string): string {
  const [anio, mes] = fechaISO.split("-");
  return `${anio}-${mes}-01`;
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const defecto = rangoMesActual();

  const desde = params.get("desde") ?? defecto.desde;
  const hasta = params.get("hasta") ?? defecto.hasta;

  const desdeAcumulado = inicioDeMes(hasta);
  const hastaAcumulado = hasta;

  const carteraPorGestor = await consultarFilas<FilaCarteraPorGestor>(
    `
        SELECT
          gestor,
          COUNT(DISTINCT idc)::int AS total
        FROM cuentas
        WHERE gestor IS NOT NULL
          AND ${CONDICION_CARTERA}
        GROUP BY gestor
      `,
  );

  const mapaCartera = new Map(
    carteraPorGestor.map((fila) => [fila.gestor, fila.total]),
  );

  const kpis = await consultarUno<KpisRango>(
    `
        SELECT
          COUNT(*)::int AS "totalGestiones",
          COUNT(DISTINCT g.idc)::int AS "clientesDistintos"
        FROM gestiones g
        WHERE LEFT(g.fecha_hora, 10)
          BETWEEN $1 AND $2
      `,
    [desde, hasta],
  );

  const porGestor = await consultarFilas<FilaPorGestor>(
    `
        SELECT
          g.usuario_gestor_oficina AS gestor,

          COUNT(*)::int
            AS "gestionesRealizadas",

          COUNT(
            DISTINCT CASE
              WHEN g.categoria = 'TAT'
              THEN g.idc
            END
          )::int
            AS "clientesDistintosConTat"

        FROM gestiones g

        WHERE LEFT(g.fecha_hora, 10)
          BETWEEN $1 AND $2

        GROUP BY
          g.usuario_gestor_oficina

        ORDER BY
          g.usuario_gestor_oficina
      `,
    [desde, hasta],
  );

  const porDia = await consultarFilas<FilaPorDia>(
    `
        SELECT
          LEFT(g.fecha_hora, 10) AS fecha,
          COUNT(*)::int AS gestiones

        FROM gestiones g

        WHERE LEFT(g.fecha_hora, 10)
          BETWEEN $1 AND $2

        GROUP BY
          LEFT(g.fecha_hora, 10)

        ORDER BY
          fecha
      `,
    [desde, hasta],
  );

  const resumenDiarioRaw = await consultarFilas<FilaResumenDiarioRaw>(
    `
        SELECT
          g.fecha,

          g.usuario_gestor_oficina
            AS gestor,

          c.funcionario,

          COUNT(*)::int
            AS "gestionesRealizadas",

          COUNT(
            DISTINCT CASE
              WHEN g.categoria = 'TAT'
              THEN g.idc
            END
          )::int
            AS "clientesDistintosConTat",

          (
            SELECT COUNT(*)::int
            FROM promesas_pago pp
            WHERE pp.usuario_gestor_oficina =
                  g.usuario_gestor_oficina
              AND LEFT(pp.fecha_hora, 10) = g.fecha
          ) AS "promesasCreadas",

          (
            SELECT COUNT(*)::int
            FROM promesas_pago pp
            WHERE pp.usuario_gestor_oficina =
                  g.usuario_gestor_oficina
              AND LEFT(pp.fecha_hora, 10) = g.fecha
              AND pp.estado = 'cumplida'
          ) AS "promesasCumplidas",

          (
            SELECT COUNT(*)::int
            FROM citas ci
            WHERE ci.usuario_gestor_oficina =
                  g.usuario_gestor_oficina
              AND LEFT(ci.fecha_hora, 10) = g.fecha
          ) AS "citasAgendadas"

        FROM (
          SELECT
            g0.*,
            LEFT(g0.fecha_hora, 10) AS fecha
          FROM gestiones g0
        ) g

        ${JOIN_CUENTA_REPRESENTATIVA}

        WHERE g.fecha
          BETWEEN $1 AND $2

        GROUP BY
          g.fecha,
          g.usuario_gestor_oficina,
          c.funcionario

        ORDER BY
          g.fecha DESC
      `,
    [desde, hasta],
  );

  const resumenDiario = resumenDiarioRaw.map((fila) => {
    const totalCartera = mapaCartera.get(fila.gestor) ?? 0;

    return {
      ...fila,

      intensidadDiaria:
        totalCartera > 0 ? fila.gestionesRealizadas / totalCartera : 0,

      contactabilidadDiaria:
        totalCartera > 0
          ? Math.round((fila.clientesDistintosConTat / totalCartera) * 100)
          : 0,

      promesasCumplidasPorcentaje:
        fila.promesasCreadas > 0
          ? Math.round((fila.promesasCumplidas / fila.promesasCreadas) * 100)
          : 0,
    };
  });

  const comparativaGestores = porGestor.map((fila) => {
    const totalCartera = mapaCartera.get(fila.gestor) ?? 0;

    return {
      gestor: fila.gestor,

      intensidad:
        totalCartera > 0 ? fila.gestionesRealizadas / totalCartera : 0,

      contactabilidad:
        totalCartera > 0
          ? Math.round((fila.clientesDistintosConTat / totalCartera) * 100)
          : 0,
    };
  });

  const kpisAcumulado = await consultarUno<Total>(
    `
        SELECT
          COUNT(*)::int AS total
        FROM gestiones g
        WHERE LEFT(g.fecha_hora, 10)
          BETWEEN $1 AND $2
      `,
    [desdeAcumulado, hastaAcumulado],
  );

  const clientesDistintosAcumulado = await consultarUno<Total>(
    `
        SELECT
          COUNT(DISTINCT g.idc)::int AS total
        FROM gestiones g
        WHERE LEFT(g.fecha_hora, 10)
          BETWEEN $1 AND $2
      `,
    [desdeAcumulado, hastaAcumulado],
  );

  const carteraActiva = await consultarUno<Total>(
    `
        SELECT
          COUNT(DISTINCT idc)::int AS total
        FROM cuentas
        WHERE ${CONDICION_CARTERA}
      `,
  );

  const totalCarteraActiva = carteraActiva?.total ?? 0;

  const intensidadMes =
    totalCarteraActiva > 0
      ? (kpisAcumulado?.total ?? 0) / totalCarteraActiva
      : 0;

  const coberturaMes =
    totalCarteraActiva > 0
      ? ((clientesDistintosAcumulado?.total ?? 0) / totalCarteraActiva) * 100
      : 0;

  const promesasPorEstado = await consultarUno<PromesasPorEstado>(
    `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN estado = 'vigente'
                THEN 1
                ELSE 0
              END
            ),
            0
          )::int AS vigentes,

          COALESCE(
            SUM(
              CASE
                WHEN estado = 'cumplida'
                THEN 1
                ELSE 0
              END
            ),
            0
          )::int AS cumplidas,

          COALESCE(
            SUM(
              CASE
                WHEN estado = 'rota'
                THEN 1
                ELSE 0
              END
            ),
            0
          )::int AS rotas

        FROM promesas_pago

        WHERE LEFT(fecha_hora, 10)
          BETWEEN $1 AND $2
      `,
    [desde, hasta],
  );

  return NextResponse.json({
    metaIntensidad: META_INTENSIDAD,
    metaCobertura: META_COBERTURA,

    kpis: {
      totalGestiones: kpis?.totalGestiones ?? 0,

      clientesDistintos: kpis?.clientesDistintos ?? 0,
    },

    intensidadMes,
    coberturaMes,

    carteraActivaTotal: totalCarteraActiva,

    comparativaGestores,

    tendenciaDiaria: porDia,

    resumenDiario,

    rangoAcumulado: {
      desde: desdeAcumulado,
      hasta: hastaAcumulado,
    },

    promesasPorEstado: {
      vigentes: promesasPorEstado?.vigentes ?? 0,

      cumplidas: promesasPorEstado?.cumplidas ?? 0,

      rotas: promesasPorEstado?.rotas ?? 0,
    },
  });
}
