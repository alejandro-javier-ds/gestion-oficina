// app/api/dashboard/gestiones/route.ts
//
// Datos del Dashboard de Gestiones.
//
// Incluye:
// - Feed de actividad reciente
// - Detalle para tabla dinámica
// - Gestiones por categoría
// - Principales razones de gestión
// - Etapa procesal
// - Tipo de juicio
// - Monto recuperado

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";
import { CODIGOS_DOLARES, separarMontoPorMoneda } from "@/lib/monedas";

export const runtime = "nodejs";

type FilaFeed = {
  id: number;
  fecha_hora: string;
  gestor: string;
  cliente: string;
  categoria: string | null;
  codigo_razon: string | null;
};

type FilaDetalle = {
  fecha: string;
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
  producto: string | null;
  estado_cartera: string | null;
  etapa_procesal: string | null;
  prioridad: string | null;
  direccion: string | null;
  distrito: string | null;
  departamento: string | null;
  router: string | null;
  nivel_riesgo: string | null;
  provincia: string | null;
  expediente: string | null;
  tipo_juicio: string | null;
  nro_juicio: string | null;
  fec_demanda: string | null;
  supervisor_procesal: string | null;
  analista_procesal: string | null;
  fec_entrega_legajo_a_estudio: string | null;
  n_garantias: number;
  valor_garantias: number;
  promesas_vigentes: number;
  promesas_cumplidas: number;
  promesas_rotas: number;
  citas_pendientes: number;
};

type FilaEtapaProcesal = {
  etapa_procesal: string | null;
  cantidad: number;
};

type FilaTipoJuicio = {
  tipo_juicio: string | null;
  cantidad: number;
};

type FilaCategoria = {
  categoria: string | null;
  cantidad: number;
};

type FilaRazon = {
  codigo_razon: string | null;
  cantidad: number;
};

type FilaMontoRecuperado = {
  soles: number;
  dolares: number;
};

const JOIN_CUENTA_REPRESENTATIVA = `
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
`;

const SUBCONSULTAS_RESUMEN = `
  (
    SELECT COUNT(*)::int
    FROM garantias ga
    WHERE ga.idc = g.idc
      AND ga.activo = 1
  ) AS n_garantias,

  (
    SELECT COALESCE(
      SUM(ga.monto_realizacion),
      0
    )
    FROM garantias ga
    WHERE ga.idc = g.idc
      AND ga.activo = 1
  ) AS valor_garantias,

  (
    SELECT COUNT(*)::int
    FROM promesas_pago pp
    WHERE pp.idc = g.idc
      AND pp.estado = 'vigente'
  ) AS promesas_vigentes,

  (
    SELECT COUNT(*)::int
    FROM promesas_pago pp
    WHERE pp.idc = g.idc
      AND pp.estado = 'cumplida'
  ) AS promesas_cumplidas,

  (
    SELECT COUNT(*)::int
    FROM promesas_pago pp
    WHERE pp.idc = g.idc
      AND pp.estado = 'rota'
  ) AS promesas_rotas,

  (
    SELECT COUNT(*)::int
    FROM citas ci
    WHERE ci.idc = g.idc
      AND ci.estado = 'pendiente'
  ) AS citas_pendientes
`;

const EXCLUYE_PDP = `
  AND (
    g.categoria IS NULL
    OR g.categoria != 'PDP'
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

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado",
      },
      {
        status: 401,
      },
    );
  }

  const params = request.nextUrl.searchParams;

  const defecto = rangoMesActual();

  const desde = params.get("desde") ?? defecto.desde;

  const hasta = params.get("hasta") ?? defecto.hasta;

  const feed = await consultarFilas<FilaFeed>(
    `
        SELECT
          g.id::int AS id,
          g.fecha_hora,
          g.usuario_gestor_oficina AS gestor,
          c.cliente,
          g.categoria,
          g.codigo_razon

        FROM gestiones g

        ${JOIN_CUENTA_REPRESENTATIVA}

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        ${EXCLUYE_PDP}

        ORDER BY
          g.fecha_hora DESC

        LIMIT 10
      `,
    [desde, hasta],
  );

  const detalle = await consultarFilas<FilaDetalle>(
    `
        SELECT
          LEFT(
            g.fecha_hora,
            10
          ) AS fecha,

          g.usuario_gestor_oficina AS gestor,
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

          c.descproducto AS producto,

          c.estado_cartera,
          c.etapa_procesal,
          c.prioridad,
          c.direccion,
          c.distrito,
          c.departamento,
          c.router,
          c.nivel_riesgo,
          c.provincia,
          c.expediente,
          c.tipo_juicio,
          c.nro_juicio,
          c.fec_demanda,
          c.supervisor_procesal,
          c.analista_procesal,
          c.fec_entrega_legajo_a_estudio,

          ${SUBCONSULTAS_RESUMEN}

        FROM gestiones g

        ${JOIN_CUENTA_REPRESENTATIVA}

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        ${EXCLUYE_PDP}
      `,
    [desde, hasta],
  );

  const porCategoria = await consultarFilas<FilaCategoria>(
    `
        SELECT
          g.categoria,
          COUNT(*)::int AS cantidad

        FROM gestiones g

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        ${EXCLUYE_PDP}

        GROUP BY
          g.categoria

        ORDER BY
          cantidad DESC
      `,
    [desde, hasta],
  );

  const porRazon = await consultarFilas<FilaRazon>(
    `
        SELECT
          g.codigo_razon,
          COUNT(*)::int AS cantidad

        FROM gestiones g

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        ${EXCLUYE_PDP}

        AND g.codigo_razon IS NOT NULL
        AND TRIM(
          g.codigo_razon
        ) != ''

        GROUP BY
          g.codigo_razon

        ORDER BY
          cantidad DESC

        LIMIT 10
      `,
    [desde, hasta],
  );

  const porEtapaProcesal = await consultarFilas<FilaEtapaProcesal>(
    `
        SELECT
          c.etapa_procesal,
          COUNT(*)::int AS cantidad

        FROM gestiones g

        ${JOIN_CUENTA_REPRESENTATIVA}

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        ${EXCLUYE_PDP}

        GROUP BY
          c.etapa_procesal

        ORDER BY
          cantidad DESC
      `,
    [desde, hasta],
  );

  const porTipoJuicio = await consultarFilas<FilaTipoJuicio>(
    `
        SELECT
          c.tipo_juicio,
          COUNT(*)::int AS cantidad

        FROM gestiones g

        ${JOIN_CUENTA_REPRESENTATIVA}

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        AND c.tipo_juicio IS NOT NULL

        ${EXCLUYE_PDP}

        GROUP BY
          c.tipo_juicio

        ORDER BY
          cantidad DESC
      `,
    [desde, hasta],
  );

  const montoRecuperado = await consultarUno<FilaMontoRecuperado>(
    `
        SELECT
          COALESCE(SUM(g.monto_pagado) FILTER (
            WHERE NOT COALESCE(
              UPPER(TRIM(g.moneda_monto_pagado)) = ANY($3::text[]), FALSE
            )
          ), 0) AS soles,
          COALESCE(SUM(g.monto_pagado) FILTER (
            WHERE UPPER(TRIM(g.moneda_monto_pagado)) = ANY($3::text[])
          ), 0) AS dolares

        FROM gestiones g

        WHERE LEFT(
          g.fecha_hora,
          10
        ) BETWEEN $1 AND $2

        ${EXCLUYE_PDP}
      `,
    [desde, hasta, CODIGOS_DOLARES],
  );

  return NextResponse.json({
    feed,

    detalle: detalle.map((fila) => {
      const pagado = separarMontoPorMoneda(
        fila.monto_pagado,
        fila.moneda_monto_pagado,
      );
      return {
        ...fila,
        monto_pagado_soles: pagado.soles,
        monto_pagado_dolares: pagado.dolares,
      };
    }),

    porCategoria: porCategoria.map((fila) => ({
      categoria: fila.categoria?.trim() || "Otras",

      cantidad: fila.cantidad,
    })),

    porRazon: porRazon.map((fila) => ({
      razon: fila.codigo_razon?.trim() || "Sin razón",

      cantidad: fila.cantidad,
    })),

    porEtapaProcesal: porEtapaProcesal.map((fila) => ({
      etapa: fila.etapa_procesal ?? "Sin etapa registrada",

      cantidad: fila.cantidad,
    })),

    porTipoJuicio: porTipoJuicio.map((fila) => ({
      tipoJuicio: fila.tipo_juicio ?? "Sin tipo registrado",

      cantidad: fila.cantidad,
    })),

    montoRecuperadoMes: montoRecuperado?.soles ?? 0,
    montoRecuperadoMesDolares: montoRecuperado?.dolares ?? 0,
  });
}
