// app/api/dashboard/indicadores/route.ts
// Trae todo lo que necesita la Sección Indicadores del Dashboard.
//   - Cobertura = clientes distintos TOCADOS ÷ clientes de cartera.
//   - Contactabilidad = clientes distintos con AL MENOS 1 TAT
//     ÷ clientes de cartera.
//   - Intensidad = total de gestiones CON REPETICIÓN ÷ clientes
//     de cartera.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

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

const CONDICION_CARTERA = `
  activo = 1
  AND UPPER(TRIM(estado_cartera)) IN ('ACTIVA', 'CASTIGO')
`;

const JOIN_CUENTA_REPRESENTATIVA = `
  JOIN cuentas c ON c.codcuentacobranza = COALESCE(
    g.codcuentacobranza,
    (
      SELECT codcuentacobranza
      FROM cuentas cc
      WHERE cc.idc = g.idc
        AND ${CONDICION_CARTERA.replace(/\bactivo\b/g, "cc.activo").replace(/\bestado_cartera\b/g, "cc.estado_cartera")}
      ORDER BY cc.mtodeuda_sol DESC
      LIMIT 1
    )
  )
`;

function rangoMesActual(): { desde: string; hasta: string } {
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

  const carteraPorGestor = db
    .prepare(
      `SELECT gestor, COUNT(DISTINCT idc) as total
       FROM cuentas
       WHERE gestor IS NOT NULL
         AND ${CONDICION_CARTERA}
       GROUP BY gestor`,
    )
    .all() as FilaCarteraPorGestor[];

  const mapaCartera = new Map(carteraPorGestor.map((f) => [f.gestor, f.total]));

  const kpis = db
    .prepare(
      `SELECT
         COUNT(*) as totalGestiones,
         COUNT(DISTINCT g.idc) as clientesDistintos
       FROM gestiones g
       WHERE date(g.fecha_hora) BETWEEN ? AND ?`,
    )
    .get(desde, hasta) as {
      totalGestiones: number;
      clientesDistintos: number;
    };

  const porGestor = db
    .prepare(
      `SELECT
         g.usuario_gestor_oficina as gestor,
         COUNT(*) as gestionesRealizadas,
         COUNT(DISTINCT CASE WHEN g.categoria = 'TAT' THEN g.idc END) as clientesDistintosConTat
       FROM gestiones g
       WHERE date(g.fecha_hora) BETWEEN ? AND ?
       GROUP BY g.usuario_gestor_oficina
       ORDER BY g.usuario_gestor_oficina`,
    )
    .all(desde, hasta) as FilaPorGestor[];

  const porDia = db
    .prepare(
      `SELECT
         date(g.fecha_hora) as fecha,
         COUNT(*) as gestiones
       FROM gestiones g
       WHERE date(g.fecha_hora) BETWEEN ? AND ?
       GROUP BY date(g.fecha_hora)
       ORDER BY fecha`,
    )
    .all(desde, hasta) as FilaPorDia[];

  const resumenDiarioRaw = db
    .prepare(
      `SELECT
         date(g.fecha_hora) as fecha,
         g.usuario_gestor_oficina as gestor,
         c.funcionario,
         COUNT(*) as gestionesRealizadas,
         COUNT(DISTINCT CASE WHEN g.categoria = 'TAT' THEN g.idc END) as clientesDistintosConTat,
         (SELECT COUNT(*) FROM promesas_pago pp
            WHERE pp.usuario_gestor_oficina = g.usuario_gestor_oficina
              AND date(pp.fecha_hora) = date(g.fecha_hora)) as promesasCreadas,
         (SELECT COUNT(*) FROM promesas_pago pp
            WHERE pp.usuario_gestor_oficina = g.usuario_gestor_oficina
              AND date(pp.fecha_hora) = date(g.fecha_hora)
              AND pp.estado = 'cumplida') as promesasCumplidas,
         (SELECT COUNT(*) FROM citas ci
            WHERE ci.usuario_gestor_oficina = g.usuario_gestor_oficina
              AND date(ci.fecha_hora) = date(g.fecha_hora)) as citasAgendadas
       FROM gestiones g
       ${JOIN_CUENTA_REPRESENTATIVA}
       WHERE date(g.fecha_hora) BETWEEN ? AND ?
       GROUP BY date(g.fecha_hora), g.usuario_gestor_oficina, c.funcionario
       ORDER BY fecha DESC`,
    )
    .all(desde, hasta) as FilaResumenDiarioRaw[];

  const resumenDiario = resumenDiarioRaw.map((f) => {
    const totalCartera = mapaCartera.get(f.gestor) ?? 0;

    return {
      ...f,
      intensidadDiaria:
        totalCartera > 0 ? f.gestionesRealizadas / totalCartera : 0,
      contactabilidadDiaria:
        totalCartera > 0
          ? Math.round((f.clientesDistintosConTat / totalCartera) * 100)
          : 0,
      promesasCumplidasPorcentaje:
        f.promesasCreadas > 0
          ? Math.round((f.promesasCumplidas / f.promesasCreadas) * 100)
          : 0,
    };
  });

  const comparativaGestores = porGestor.map((f) => {
    const totalCartera = mapaCartera.get(f.gestor) ?? 0;

    return {
      gestor: f.gestor,
      intensidad: totalCartera > 0 ? f.gestionesRealizadas / totalCartera : 0,
      contactabilidad:
        totalCartera > 0
          ? Math.round((f.clientesDistintosConTat / totalCartera) * 100)
          : 0,
    };
  });

  const kpisAcumulado = db
    .prepare(
      `SELECT COUNT(*) as totalGestiones
       FROM gestiones g
       WHERE date(g.fecha_hora) BETWEEN ? AND ?`,
    )
    .get(desdeAcumulado, hastaAcumulado) as {
      totalGestiones: number;
    };

  const clientesDistintosAcumulado = db
    .prepare(
      `SELECT COUNT(DISTINCT g.idc) as total
       FROM gestiones g
       WHERE date(g.fecha_hora) BETWEEN ? AND ?`,
    )
    .get(desdeAcumulado, hastaAcumulado) as {
      total: number;
    };

  const carteraActiva = db
    .prepare(
      `SELECT COUNT(DISTINCT idc) as total
       FROM cuentas
       WHERE ${CONDICION_CARTERA}`,
    )
    .get() as { total: number };

  const intensidadMes =
    carteraActiva.total > 0
      ? kpisAcumulado.totalGestiones / carteraActiva.total
      : 0;

  const coberturaMes =
    carteraActiva.total > 0
      ? (clientesDistintosAcumulado.total / carteraActiva.total) * 100
      : 0;

  const promesasPorEstado = db
    .prepare(
      `SELECT
         SUM(CASE WHEN estado = 'vigente' THEN 1 ELSE 0 END) as vigentes,
         SUM(CASE WHEN estado = 'cumplida' THEN 1 ELSE 0 END) as cumplidas,
         SUM(CASE WHEN estado = 'rota' THEN 1 ELSE 0 END) as rotas
       FROM promesas_pago
       WHERE date(fecha_hora) BETWEEN ? AND ?`,
    )
    .get(desde, hasta) as {
      vigentes: number | null;
      cumplidas: number | null;
      rotas: number | null;
    };

  return NextResponse.json({
    metaIntensidad: META_INTENSIDAD,
    metaCobertura: META_COBERTURA,
    kpis: {
      totalGestiones: kpis.totalGestiones,
      clientesDistintos: kpis.clientesDistintos,
    },
    intensidadMes,
    coberturaMes,
    carteraActivaTotal: carteraActiva.total,
    comparativaGestores,
    tendenciaDiaria: porDia,
    resumenDiario,
    rangoAcumulado: {
      desde: desdeAcumulado,
      hasta: hastaAcumulado,
    },
    promesasPorEstado: {
      vigentes: promesasPorEstado.vigentes ?? 0,
      cumplidas: promesasPorEstado.cumplidas ?? 0,
      rotas: promesasPorEstado.rotas ?? 0,
    },
  });
}
