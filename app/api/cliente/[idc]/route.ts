// app/api/cliente/[idc]/route.ts
// Trae todo lo que necesita la ficha de cliente.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import { Cuenta, Garantia, Apersonamiento } from "@/lib/types";

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
  qtty_phone_ranking: number | null;
  creado_por: string | null;
  editado_por: string | null;
  fecha_modificacion: string | null;
  agregado_manualmente: number;
};

type Direccion = {
  id: number;
  direccion: string;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  tipo: string;
  fuente: string;
  fecha_modificacion: string;
};

type HistorialRouter = {
  id: number;
  fecha_registro: string;
  seguimiento: string;
  router: string;
  descripcion: string | null;
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

  const cuentas = db
    .prepare(
      "SELECT * FROM cuentas WHERE idc = ? AND activo = 1 ORDER BY codcuentacobranza",
    )
    .all(idc) as Cuenta[];

  if (cuentas.length === 0) {
    return NextResponse.json(
      { error: "Cliente no encontrado o sin cuentas activas" },
      { status: 404 },
    );
  }

  if (
    sesion.rol === "gestor" &&
    !cuentas.some((c) => c.gestor === sesion.gestor)
  ) {
    return NextResponse.json(
      { error: "No tienes acceso a este cliente" },
      { status: 403 },
    );
  }

  const cabecera = cuentas[0];

  const segmentacionReciente = db
    .prepare(
      "SELECT segmentacion FROM gestiones WHERE idc = ? AND segmentacion IS NOT NULL ORDER BY fecha_hora DESC LIMIT 1",
    )
    .get(idc) as { segmentacion: string } | undefined;

  const garantias = db
    .prepare("SELECT * FROM garantias WHERE idc = ? AND activo = 1")
    .all(idc) as Garantia[];

  const telefonos = db
    .prepare(
      `SELECT id_phone, phone, tipo_telefono, qtty_phone_ranking, creado_por, editado_por, fecha_modificacion, agregado_manualmente
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

  const direcciones = db
    .prepare(
      `SELECT id, direccion, distrito, provincia, departamento, tipo, fuente, fecha_modificacion
       FROM direcciones
       WHERE idc = ? AND activo = 1
       ORDER BY fuente DESC, fecha_modificacion DESC`,
    )
    .all(idc) as Direccion[];

  const cic = db
    .prepare(
      "SELECT cic FROM telefonos WHERE idc = ? AND cic IS NOT NULL LIMIT 1",
    )
    .get(idc) as { cic: string } | undefined;

  const apersonamiento = db
    .prepare(
      "SELECT * FROM apersonamiento WHERE idc = ? AND activo = 1 ORDER BY fecha_entrega DESC",
    )
    .all(idc) as Apersonamiento[];

  const historialRouter = db
    .prepare(
      "SELECT id, fecha_registro, seguimiento, router, descripcion FROM historial_router WHERE idc = ? ORDER BY fecha_registro DESC, id DESC",
    )
    .all(idc) as HistorialRouter[];

  return NextResponse.json({
    idc,
    cliente: cabecera.cliente,
    prioridad: cabecera.prioridad,
    router: cabecera.router,
    nivelRiesgo: cabecera.nivel_riesgo,
    segmentacion: segmentacionReciente?.segmentacion ?? null,
    funcionario: cabecera.funcionario,
    direccion: cabecera.direccion,
    distrito: cabecera.distrito,
    provincia: cabecera.provincia,
    departamento: cabecera.departamento,
    expediente: cabecera.expediente,
    tipoJuicio: cabecera.tipo_juicio,
    nroJuicio: cabecera.nro_juicio,
    fecDemanda: cabecera.fec_demanda,
    supervisorProcesal: cabecera.supervisor_procesal,
    analistaProcesal: cabecera.analista_procesal,
    cuentas,
    garantias,
    telefonos,
    direcciones,
    cic: cic?.cic ?? null,
    apersonamiento,
    historialRouter,
  });
}
