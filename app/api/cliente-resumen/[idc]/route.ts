// app/api/cliente-resumen/[idc]/route.ts

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

type CuentaResumen = {
  codcuentacobranza: string;
  mtodeuda_sol: number | null;
  diasmora: number | null;
};

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
  creado_por: string | null;
  editado_por: string | null;
  fecha_modificacion: string | null;
  agregado_manualmente: number;
};

type GarantiaResumen = {
  gar_codigo: string;
  tipo_garantia: string | null;
  descripcion: string | null;
  monto_realizacion: number | null;
};

type PromesaResumen = {
  id: number;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  fecha_promesa: string;
  estado: string;
};

type CitaResumen = {
  id: number;
  tipo: string;
  fecha_cita: string;
  estado: string;
};

type DireccionResumen = {
  id: number;
  direccion: string;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  tipo: string;
  fuente: string;
  fecha_modificacion: string;
};

type HistorialRouterResumen = {
  id: number;
  fecha_registro: string;
  seguimiento: string;
  router: string;
  descripcion: string | null;
};

type CabeceraCliente = {
  cliente: string;
  expediente: string | null;
  tipo_juicio: string | null;
  nro_juicio: string | null;
  fec_demanda: string | null;
  supervisor_procesal: string | null;
  analista_procesal: string | null;
};

type ResumenGestiones = {
  total: number;
  contactoDirecto: number;
  ultimaFecha: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ idc: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { idc } = await params;

  if (sesion.rol === "gestor") {
    const perteneceAlGestor = db
      .prepare("SELECT 1 FROM cuentas WHERE idc = ? AND gestor = ? LIMIT 1")
      .get(idc, sesion.gestor);

    if (!perteneceAlGestor) {
      return NextResponse.json(
        { error: "No tienes acceso a este cliente" },
        { status: 403 },
      );
    }
  }

  const cabecera = db
    .prepare(
      `SELECT cliente, expediente, tipo_juicio, nro_juicio, fec_demanda,
              supervisor_procesal, analista_procesal
       FROM cuentas WHERE idc = ? AND activo = 1 LIMIT 1`,
    )
    .get(idc) as CabeceraCliente | undefined;

  if (!cabecera) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  const segmentacionReciente = db
    .prepare(
      "SELECT segmentacion FROM gestiones WHERE idc = ? AND segmentacion IS NOT NULL ORDER BY fecha_hora DESC LIMIT 1",
    )
    .get(idc) as { segmentacion: string } | undefined;

  const cuentas = db
    .prepare(
      "SELECT codcuentacobranza, mtodeuda_sol, diasmora FROM cuentas WHERE idc = ? AND activo = 1",
    )
    .all(idc) as CuentaResumen[];

  const deudaTotal = cuentas.reduce(
    (suma, c) => suma + (c.mtodeuda_sol ?? 0),
    0,
  );
  const moraPromedio =
    cuentas.length > 0
      ? Math.round(
        cuentas.reduce((suma, c) => suma + (c.diasmora ?? 0), 0) /
        cuentas.length,
      )
      : 0;

  const telefonos = db
    .prepare(
      `SELECT id_phone, phone, tipo_telefono, creado_por, editado_por, fecha_modificacion, agregado_manualmente
       FROM telefonos
       WHERE idc = ? AND activo = 1
       ORDER BY
         CASE tipo_telefono
           WHEN 'celular' THEN 0
           WHEN 'fijo' THEN 1
           ELSE 2
         END,
         qtty_phone_ranking DESC`,
    )
    .all(idc) as Telefono[];

  const garantias = db
    .prepare(
      "SELECT gar_codigo, tipo_garantia, descripcion, monto_realizacion FROM garantias WHERE idc = ? AND activo = 1",
    )
    .all(idc) as GarantiaResumen[];

  const promesas = db
    .prepare(
      "SELECT id, tipo, moneda, monto_deuda_total, fecha_promesa, estado FROM promesas_pago WHERE idc = ? ORDER BY fecha_hora DESC",
    )
    .all(idc) as PromesaResumen[];

  const citas = db
    .prepare(
      "SELECT id, tipo, fecha_cita, estado FROM citas WHERE idc = ? ORDER BY fecha_cita DESC",
    )
    .all(idc) as CitaResumen[];

  const direcciones = db
    .prepare(
      `SELECT id, direccion, distrito, provincia, departamento, tipo, fuente, fecha_modificacion
       FROM direcciones WHERE idc = ? AND activo = 1 ORDER BY fuente DESC, fecha_modificacion DESC`,
    )
    .all(idc) as DireccionResumen[];

  const historialRouter = db
    .prepare(
      "SELECT id, fecha_registro, seguimiento, router, descripcion FROM historial_router WHERE idc = ? ORDER BY fecha_registro DESC, id DESC",
    )
    .all(idc) as HistorialRouterResumen[];

  const gestiones = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN categoria = 'TAT' THEN 1 ELSE 0 END) as contactoDirecto,
         MAX(fecha_hora) as ultimaFecha
       FROM gestiones
       WHERE idc = ?`,
    )
    .get(idc) as ResumenGestiones;

  const contactabilidad =
    gestiones.total > 0
      ? Math.round((gestiones.contactoDirecto / gestiones.total) * 100)
      : 0;

  return NextResponse.json({
    cliente: cabecera.cliente,
    idc,
    segmentacion: segmentacionReciente?.segmentacion ?? null,
    expediente: cabecera.expediente,
    tipoJuicio: cabecera.tipo_juicio,
    nroJuicio: cabecera.nro_juicio,
    fecDemanda: cabecera.fec_demanda,
    supervisorProcesal: cabecera.supervisor_procesal,
    analistaProcesal: cabecera.analista_procesal,
    cantidadCuentas: cuentas.length,
    deudaTotal,
    moraPromedio,
    cantidadTelefonos: telefonos.length,
    gestionesHistoricas: gestiones.total,
    contactabilidadPorcentaje: contactabilidad,
    ultimaGestionFecha: gestiones.ultimaFecha,
    cuentas,
    telefonos,
    garantias,
    promesas,
    citas,
    direcciones,
    historialRouter,
  });
}
