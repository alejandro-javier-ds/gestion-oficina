// app/api/dashboard/pdps/route.ts
// Trae todo lo que necesita la pestaña PDPs. Corregido: el campo de
// fecha para la tabla dinámica ahora se formatea en hora LOCAL

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

type FilaConteo = { clave: string; cantidad: number };

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

function rangoMesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
  };
}

function formatearFechaHoraLima(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return iso;
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

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const defecto = rangoMesActual();
  const desde = params.get("desde") ?? defecto.desde;
  const hasta = params.get("hasta") ?? defecto.hasta;
  const hoy = new Date().toISOString().slice(0, 10);

  const feed = db
    .prepare(
      `SELECT
         pp.id,
         pp.idc,
         pp.fecha_hora,
         pp.usuario_gestor_oficina as gestor,
         (SELECT cliente FROM cuentas c WHERE c.idc = pp.idc AND c.activo = 1 LIMIT 1) as cliente,
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
       WHERE date(pp.fecha_hora) BETWEEN ? AND ?
       ORDER BY pp.fecha_hora DESC
       LIMIT 10`,
    )
    .all(desde, hasta) as FilaFeed[];

  const porEstado = db
    .prepare(
      `SELECT estado as clave, COUNT(*) as cantidad
       FROM promesas_pago
       WHERE date(fecha_hora) BETWEEN ? AND ?
       GROUP BY estado`,
    )
    .all(desde, hasta) as FilaConteo[];

  const porTipo = db
    .prepare(
      `SELECT tipo as clave, COUNT(*) as cantidad
       FROM promesas_pago
       WHERE date(fecha_hora) BETWEEN ? AND ?
       GROUP BY tipo`,
    )
    .all(desde, hasta) as FilaConteo[];

  const detalleCrudo = db
    .prepare(
      `SELECT
         pp.id,
         pp.idc,
         (SELECT cliente FROM cuentas c WHERE c.idc = pp.idc AND c.activo = 1 LIMIT 1) as cliente,
         pp.usuario_gestor_oficina as gestor,
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
       WHERE date(pp.fecha_hora) BETWEEN ? AND ?
       ORDER BY pp.fecha_hora DESC`,
    )
    .all(desde, hasta) as FilaDetalleCruda[];

  const detalleConVencida = detalleCrudo.map((d) => ({
    ...d,
    fecha_hora: formatearFechaHoraLima(d.fecha_hora),
    vencida: d.estado === "vigente" && d.fecha_promesa < hoy ? "Sí" : "No",
  }));

  const montoTotal = db
    .prepare(
      `SELECT COALESCE(SUM(monto_prometido), 0) as total
       FROM promesas_pago
       WHERE date(fecha_hora) BETWEEN ? AND ?`,
    )
    .get(desde, hasta) as { total: number };

  const vencidasCount = db
    .prepare(
      `SELECT COUNT(*) as total
       FROM promesas_pago
       WHERE estado = 'vigente' AND date(fecha_promesa) < ?`,
    )
    .get(hoy) as { total: number };

  const conteoVigentes =
    porEstado.find((f) => f.clave === "vigente")?.cantidad ?? 0;
  const conteoCumplidas =
    porEstado.find((f) => f.clave === "cumplida")?.cantidad ?? 0;
  const conteoRotas = porEstado.find((f) => f.clave === "rota")?.cantidad ?? 0;

  return NextResponse.json({
    feed,
    vigentes: conteoVigentes,
    cumplidas: conteoCumplidas,
    rotas: conteoRotas,
    vencidas: vencidasCount.total,
    porEstado,
    porTipo,
    detalle: detalleConVencida,
    montoTotalPromesas: montoTotal.total,
  });
}
