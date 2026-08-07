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
// - Monto recuperado del rango seleccionado
//
// PDPs quedan excluidas de toda la sección Gestiones.

import { NextRequest, NextResponse } from "next/server";

import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

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

const JOIN_CUENTA_REPRESENTATIVA = `
  JOIN cuentas c ON c.codcuentacobranza = COALESCE(
    g.codcuentacobranza,
    (
      SELECT codcuentacobranza
      FROM cuentas cc
      WHERE cc.idc = g.idc
        AND cc.activo = 1
      ORDER BY cc.mtodeuda_sol DESC
      LIMIT 1
    )
  )
`;

const SUBCONSULTAS_RESUMEN = `
  (
    SELECT COUNT(*)
    FROM garantias ga
    WHERE ga.idc = g.idc
      AND ga.activo = 1
  ) as n_garantias,

  (
    SELECT COALESCE(SUM(ga.monto_realizacion), 0)
    FROM garantias ga
    WHERE ga.idc = g.idc
      AND ga.activo = 1
  ) as valor_garantias,

  (
    SELECT COUNT(*)
    FROM promesas_pago pp
    WHERE pp.idc = g.idc
      AND pp.estado = 'vigente'
  ) as promesas_vigentes,

  (
    SELECT COUNT(*)
    FROM promesas_pago pp
    WHERE pp.idc = g.idc
      AND pp.estado = 'cumplida'
  ) as promesas_cumplidas,

  (
    SELECT COUNT(*)
    FROM promesas_pago pp
    WHERE pp.idc = g.idc
      AND pp.estado = 'rota'
  ) as promesas_rotas,

  (
    SELECT COUNT(*)
    FROM citas ci
    WHERE ci.idc = g.idc
      AND ci.estado = 'pendiente'
  ) as citas_pendientes
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
      { status: 401 },
    );
  }

  const params = request.nextUrl.searchParams;

  const defecto = rangoMesActual();

  const desde = params.get("desde") ?? defecto.desde;

  const hasta = params.get("hasta") ?? defecto.hasta;

  const feed = db
    .prepare(
      `
        SELECT
          g.id,
          g.fecha_hora,
          g.usuario_gestor_oficina as gestor,
          c.cliente,
          g.categoria,
          g.codigo_razon
        FROM gestiones g
        ${JOIN_CUENTA_REPRESENTATIVA}
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          ${EXCLUYE_PDP}
        ORDER BY g.fecha_hora DESC
        LIMIT 10
      `,
    )
    .all(desde, hasta) as FilaFeed[];

  const detalle = db
    .prepare(
      `
        SELECT
          date(g.fecha_hora) as fecha,
          g.usuario_gestor_oficina as gestor,
          c.funcionario,
          c.cliente,
          g.idc,
          g.telefono,
          g.segmentacion,
          g.categoria,
          g.codigo_razon,
          g.monto_pagado,
          g.observacion,
          c.mtodeuda_sol,
          c.diasmora,
          c.rango_mora,
          c.descproducto as producto,
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
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          ${EXCLUYE_PDP}
      `,
    )
    .all(desde, hasta) as FilaDetalle[];

  const porCategoria = db
    .prepare(
      `
        SELECT
          g.categoria,
          COUNT(*) as cantidad
        FROM gestiones g
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          ${EXCLUYE_PDP}
        GROUP BY g.categoria
        ORDER BY cantidad DESC
      `,
    )
    .all(desde, hasta) as FilaCategoria[];

  const porRazon = db
    .prepare(
      `
        SELECT
          g.codigo_razon,
          COUNT(*) as cantidad
        FROM gestiones g
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          ${EXCLUYE_PDP}
          AND g.codigo_razon IS NOT NULL
          AND TRIM(g.codigo_razon) != ''
        GROUP BY g.codigo_razon
        ORDER BY cantidad DESC
        LIMIT 10
      `,
    )
    .all(desde, hasta) as FilaRazon[];

  const porEtapaProcesal = db
    .prepare(
      `
        SELECT
          c.etapa_procesal,
          COUNT(*) as cantidad
        FROM gestiones g
        ${JOIN_CUENTA_REPRESENTATIVA}
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          ${EXCLUYE_PDP}
        GROUP BY c.etapa_procesal
        ORDER BY cantidad DESC
      `,
    )
    .all(desde, hasta) as FilaEtapaProcesal[];

  const porTipoJuicio = db
    .prepare(
      `
        SELECT
          c.tipo_juicio,
          COUNT(*) as cantidad
        FROM gestiones g
        ${JOIN_CUENTA_REPRESENTATIVA}
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          AND c.tipo_juicio IS NOT NULL
          ${EXCLUYE_PDP}
        GROUP BY c.tipo_juicio
        ORDER BY cantidad DESC
      `,
    )
    .all(desde, hasta) as FilaTipoJuicio[];

  const montoRecuperado = db
    .prepare(
      `
        SELECT
          COALESCE(
            SUM(g.monto_pagado),
            0
          ) as total
        FROM gestiones g
        WHERE date(g.fecha_hora)
          BETWEEN ? AND ?
          ${EXCLUYE_PDP}
      `,
    )
    .get(desde, hasta) as {
      total: number;
    };

  return NextResponse.json({
    feed,

    detalle,

    porCategoria: porCategoria.map((f) => ({
      categoria: f.categoria?.trim() || "Otras",
      cantidad: f.cantidad,
    })),

    porRazon: porRazon.map((f) => ({
      razon: f.codigo_razon?.trim() || "Sin razón",
      cantidad: f.cantidad,
    })),

    porEtapaProcesal: porEtapaProcesal.map((f) => ({
      etapa: f.etapa_procesal ?? "Sin etapa registrada",
      cantidad: f.cantidad,
    })),

    porTipoJuicio: porTipoJuicio.map((f) => ({
      tipoJuicio: f.tipo_juicio ?? "Sin tipo registrado",
      cantidad: f.cantidad,
    })),

    montoRecuperadoMes: montoRecuperado.total,
  });
}
