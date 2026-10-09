// app/api/cliente/[idc]/route.ts
//
// Devuelve toda la información necesaria para la ficha de un cliente.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { Cuenta, Garantia, Apersonamiento } from "@/lib/types";

export const runtime = "nodejs";

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

type CicFila = {
  cic: string;
};

type SegmentacionFila = {
  segmentacion: string;
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
  try {
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

    const cuentas = await consultarFilas<Cuenta>(
      `
        SELECT *
        FROM cuentas
        WHERE idc = $1
          AND activo = 1
        ORDER BY codcuentacobranza
      `,
      [idc],
    );

    if (cuentas.length === 0) {
      return NextResponse.json(
        {
          error: "Cliente no encontrado o sin cuentas activas",
        },
        {
          status: 404,
        },
      );
    }

    const cabecera = cuentas[0];

    const garantias = await consultarFilas<Garantia>(
      `
        SELECT *
        FROM garantias
        WHERE idc = $1
          AND activo = 1
      `,
      [idc],
    );

    const telefonos = await consultarFilas<Telefono>(
      `
        SELECT
          id_phone,
          phone,
          tipo_telefono,
          qtty_phone_ranking,
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

    const direcciones = await consultarFilas<Direccion>(
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

    const cic = await consultarUno<CicFila>(
      `
        SELECT cic
        FROM telefonos
        WHERE idc = $1
          AND cic IS NOT NULL
        LIMIT 1
      `,
      [idc],
    );

    const apersonamiento = await consultarFilas<Apersonamiento>(
      `
        SELECT *
        FROM apersonamiento
        WHERE idc = $1
          AND activo = 1
        ORDER BY fecha_entrega DESC
      `,
      [idc],
    );

    const historialRouter = await consultarFilas<HistorialRouter>(
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

    const segmentacionReciente = await consultarUno<SegmentacionFila>(
      `
        SELECT segmentacion
        FROM gestiones
        WHERE idc = $1
          AND segmentacion IS NOT NULL
        ORDER BY fecha_hora DESC
        LIMIT 1
      `,
      [idc],
    );

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
  } catch (error) {
    console.error("[Ficha cliente] Error al cargar los datos:", error);
    return NextResponse.json(
      { error: "No se pudo cargar el cliente." },
      { status: 500 },
    );
  }
}
