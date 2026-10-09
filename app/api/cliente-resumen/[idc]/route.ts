// app/api/cliente-resumen/[idc]/route.ts
//
// Resumen completo del cliente.
//
// Todos los usuarios autenticados pueden consultar el resumen de
// cualquier cliente activo, independientemente del gestor asignado.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

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

type SegmentacionReciente = {
  segmentacion: string;
};

type ResumenGestiones = {
  total: number;
  contactoDirecto: number;
  ultimaFecha: string | null;
};

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      idc: string;
    }>;
  },
) {
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

  const { idc } = await params;

  const cabecera = await consultarUno<CabeceraCliente>(
    `
      SELECT
        cliente,
        expediente,
        tipo_juicio,
        nro_juicio,
        fec_demanda,
        supervisor_procesal,
        analista_procesal
      FROM cuentas
      WHERE idc = $1
        AND activo = 1
      LIMIT 1
    `,
    [idc],
  );

  if (!cabecera) {
    return NextResponse.json(
      {
        error: "Cliente no encontrado",
      },
      {
        status: 404,
      },
    );
  }

  const segmentacionReciente = await consultarUno<SegmentacionReciente>(
    `
      SELECT
        segmentacion
      FROM gestiones
      WHERE idc = $1
        AND segmentacion IS NOT NULL
      ORDER BY fecha_hora DESC
      LIMIT 1
    `,
    [idc],
  );

  const cuentas = await consultarFilas<CuentaResumen>(
    `
      SELECT
        codcuentacobranza,
        mtodeuda_sol,
        diasmora
      FROM cuentas
      WHERE idc = $1
        AND activo = 1
    `,
    [idc],
  );

  const deudaTotal = cuentas.reduce(
    (suma, cuenta) => suma + (cuenta.mtodeuda_sol ?? 0),
    0,
  );

  const moraPromedio =
    cuentas.length > 0
      ? Math.round(
        cuentas.reduce((suma, cuenta) => suma + (cuenta.diasmora ?? 0), 0) /
        cuentas.length,
      )
      : 0;

  const telefonos = await consultarFilas<Telefono>(
    `
      SELECT
        id_phone,
        phone,
        tipo_telefono,
        creado_por,
        editado_por,
        fecha_modificacion,
        agregado_manualmente
      FROM telefonos
      WHERE idc = $1
        AND activo = 1
      ORDER BY
        CASE tipo_telefono
          WHEN 'celular' THEN 0
          WHEN 'fijo' THEN 1
          ELSE 2
        END,
        qtty_phone_ranking DESC
    `,
    [idc],
  );

  const garantias = await consultarFilas<GarantiaResumen>(
    `
      SELECT
        gar_codigo,
        tipo_garantia,
        descripcion,
        monto_realizacion
      FROM garantias
      WHERE idc = $1
        AND activo = 1
    `,
    [idc],
  );

  const promesas = await consultarFilas<PromesaResumen>(
    `
      SELECT
        id,
        tipo,
        moneda,
        monto_deuda_total,
        fecha_promesa,
        estado
      FROM promesas_pago
      WHERE idc = $1
      ORDER BY fecha_hora DESC
    `,
    [idc],
  );

  const citas = await consultarFilas<CitaResumen>(
    `
      SELECT
        id,
        tipo,
        fecha_cita,
        estado
      FROM citas
      WHERE idc = $1
      ORDER BY fecha_cita DESC
    `,
    [idc],
  );

  const direcciones = await consultarFilas<DireccionResumen>(
    `
      SELECT
        id,
        direccion,
        distrito,
        provincia,
        departamento,
        tipo,
        fuente,
        fecha_modificacion
      FROM direcciones
      WHERE idc = $1
        AND activo = 1
      ORDER BY
        fuente DESC,
        fecha_modificacion DESC
    `,
    [idc],
  );

  const historialRouter = await consultarFilas<HistorialRouterResumen>(
    `
      SELECT
        id,
        fecha_registro,
        seguimiento,
        router,
        descripcion
      FROM historial_router
      WHERE idc = $1
      ORDER BY
        fecha_registro DESC,
        id DESC
    `,
    [idc],
  );

  const gestiones = await consultarUno<ResumenGestiones>(
    `
      SELECT
        COUNT(*)::int
          AS total,

        SUM(
          CASE
            WHEN categoria = 'TAT'
              THEN 1
            ELSE 0
          END
        )::int
          AS "contactoDirecto",

        MAX(fecha_hora)
          AS "ultimaFecha"

      FROM gestiones
      WHERE idc = $1
    `,
    [idc],
  );

  const totalGestiones = gestiones?.total ?? 0;

  const contactoDirecto = gestiones?.contactoDirecto ?? 0;

  const contactabilidad =
    totalGestiones > 0
      ? Math.round((contactoDirecto / totalGestiones) * 100)
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

    gestionesHistoricas: totalGestiones,

    contactabilidadPorcentaje: contactabilidad,

    ultimaGestionFecha: gestiones?.ultimaFecha ?? null,

    cuentas,
    telefonos,
    garantias,
    promesas,
    citas,
    direcciones,
    historialRouter,
  });
}
