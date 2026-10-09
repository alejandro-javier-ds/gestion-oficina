// app/api/dashboard/pdps/route.ts
//
// Datos para la pestaña PDPs del Dashboard.

import { NextRequest, NextResponse } from "next/server";
import { consultarFilas, consultarUno } from "@/lib/postgres";
import { leerSesionActual } from "@/lib/auth";
import { CODIGOS_DOLARES, separarMontoPorMoneda } from "@/lib/monedas";

export const runtime = "nodejs";

type FilaConteo = {
  clave: string;
  cantidad: number;
};

type FilaDetalleCruda = {
  id: number;
  idc: string;
  cliente: string | null;
  gestor: string;
  codcuentacobranza: string;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  monto_dolares: number | null;
  modalidad_pago: string | null;
  tipo_negociacion: string | null;
  beneficio: string | null;
  status_pdp: string | null;
  status_pago: string | null;
  numero_cuotas_aprobadas: number | null;
  estudio: string | null;
  matriz: string | null;
  observacion: string | null;
  estado: string;
  fecha_promesa: string;
  fecha_hora: string;
};

type FilaFeed = {
  id: number;
  idc: string;
  fecha_hora: string;
  gestor: string;
  cliente: string | null;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  modalidad_pago: string | null;
  observacion: string | null;
  fecha_promesa: string;
  estado: string;
  tipo_negociacion: string | null;
  beneficio: string | null;
  status_pdp: string | null;
  status_pago: string | null;
  numero_cuotas_aprobadas: number | null;
};

type FilaTotal = {
  total: number;
};

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

function formatearFechaHoraLima(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(fecha)
    .replace(", ", " ");
}

function obtenerHoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  const hoy = obtenerHoyLima();

  const feed = await consultarFilas<FilaFeed>(
    `
      SELECT
        pp.id::int AS id,
        pp.idc,
        pp.fecha_hora,

        pp.usuario_gestor_oficina
          AS gestor,

        (
          SELECT c.cliente
          FROM cuentas c
          WHERE c.idc = pp.idc
            AND c.activo = 1
          LIMIT 1
        ) AS cliente,

        pp.tipo,
        pp.moneda,
        pp.monto_deuda_total,
        pp.monto_prometido,
        pp.modalidad_pago,
        pp.observacion,
        pp.fecha_promesa,
        pp.estado,
        pp.tipo_negociacion,
        pp.beneficio,
        pp.status_pdp,
        pp.status_pago,
        pp.numero_cuotas_aprobadas

      FROM promesas_pago pp

      WHERE LEFT(pp.fecha_hora, 10)
        BETWEEN $1 AND $2

      ORDER BY
        pp.fecha_hora DESC

      LIMIT 10
    `,
    [desde, hasta],
  );

  const porEstado = await consultarFilas<FilaConteo>(
    `
      SELECT
        estado AS clave,
        COUNT(*)::int AS cantidad

      FROM promesas_pago

      WHERE LEFT(fecha_hora, 10)
        BETWEEN $1 AND $2

      GROUP BY estado
    `,
    [desde, hasta],
  );

  const porTipo = await consultarFilas<FilaConteo>(
    `
      SELECT
        tipo AS clave,
        COUNT(*)::int AS cantidad

      FROM promesas_pago

      WHERE LEFT(fecha_hora, 10)
        BETWEEN $1 AND $2

      GROUP BY tipo
    `,
    [desde, hasta],
  );

  const detalleCrudo = await consultarFilas<FilaDetalleCruda>(
    `
      SELECT
        pp.id::int AS id,
        pp.idc,

        (
          SELECT c.cliente
          FROM cuentas c
          WHERE c.idc = pp.idc
            AND c.activo = 1
          LIMIT 1
        ) AS cliente,

        pp.usuario_gestor_oficina
          AS gestor,

        pp.codcuentacobranza,
        pp.tipo,
        pp.moneda,
        pp.monto_deuda_total,
        pp.monto_prometido,
        pp.monto_dolares,
        pp.modalidad_pago,
        pp.tipo_negociacion,
        pp.beneficio,
        pp.status_pdp,
        pp.status_pago,
        pp.numero_cuotas_aprobadas,
        pp.estudio,
        pp.matriz,
        pp.observacion,
        pp.estado,
        pp.fecha_promesa,
        pp.fecha_hora

      FROM promesas_pago pp

      WHERE LEFT(pp.fecha_hora, 10)
        BETWEEN $1 AND $2

      ORDER BY
        pp.fecha_hora DESC
    `,
    [desde, hasta],
  );

  const detalleConVencida = detalleCrudo.map((fila) => {
    const deuda = separarMontoPorMoneda(fila.monto_deuda_total, fila.moneda);
    const prometido = separarMontoPorMoneda(fila.monto_prometido, fila.moneda);

    return {
      ...fila,
      monto_deuda_total_soles: deuda.soles,
      monto_deuda_total_dolares: deuda.dolares,
      monto_prometido_soles: prometido.soles,
      monto_prometido_dolares: prometido.dolares,
      fecha_hora: formatearFechaHoraLima(fila.fecha_hora),
      vencida:
        fila.estado === "vigente" && fila.fecha_promesa < hoy ? "Sí" : "No",
    };
  });

  const montoTotal = await consultarUno<{ soles: number; dolares: number }>(
    `
      SELECT
        COALESCE(SUM(monto_prometido) FILTER (
          WHERE NOT COALESCE(UPPER(TRIM(moneda)) = ANY($3::text[]), FALSE)
        ), 0) AS soles,
        COALESCE(SUM(monto_prometido) FILTER (
          WHERE UPPER(TRIM(moneda)) = ANY($3::text[])
        ), 0) AS dolares
      FROM promesas_pago
      WHERE LEFT(fecha_hora, 10) BETWEEN $1 AND $2
    `,
    [desde, hasta, CODIGOS_DOLARES],
  );

  const vencidasCount = await consultarUno<FilaTotal>(
    `
      SELECT
        COUNT(*)::int AS total

      FROM promesas_pago

      WHERE estado = 'vigente'
        AND LEFT(fecha_promesa, 10) < $1
    `,
    [hoy],
  );

  const conteoVigentes =
    porEstado.find((fila) => fila.clave === "vigente")?.cantidad ?? 0;

  const conteoCumplidas =
    porEstado.find((fila) => fila.clave === "cumplida")?.cantidad ?? 0;

  const conteoRotas =
    porEstado.find((fila) => fila.clave === "rota")?.cantidad ?? 0;

  return NextResponse.json({
    feed,

    vigentes: conteoVigentes,

    cumplidas: conteoCumplidas,

    rotas: conteoRotas,

    vencidas: vencidasCount?.total ?? 0,

    porEstado,

    porTipo,

    detalle: detalleConVencida,

    montoTotalPromesas: montoTotal?.soles ?? 0,
    montoTotalPromesasDolares: montoTotal?.dolares ?? 0,
  });
}
