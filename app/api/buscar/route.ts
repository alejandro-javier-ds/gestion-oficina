// app/api/buscar/route.ts
//
// Búsqueda de clientes por:
// - IDC exacto
// - nombre con similitud Levenshtein
//
// Todos los usuarios autenticados pueden buscar clientes activos.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { Cuenta } from "@/lib/types";
import {
  validarTextoBusqueda,
  crearPresupuestoBusqueda,
  similitudNombreAcotada,
  MAX_CANDIDATOS_BUSQUEDA,
  MAX_LONGITUD_NOMBRE,
  ErrorParametroBusqueda,
  ErrorLimiteBusqueda,
} from "@/lib/busqueda";

export const runtime = "nodejs";

type CuentaBusqueda = Pick<
  Cuenta,
  "codcuentacobranza" | "idc" | "cliente" | "mtodeuda_sol"
>;

type SegmentacionFila = {
  idc: string;
  segmentacion: string;
};

async function obtenerSegmentacionesRecientes(
  idcs: string[],
): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();

  if (idcs.length === 0) {
    return mapa;
  }

  const filas = await consultarFilas<SegmentacionFila>(
    `
      SELECT DISTINCT ON (idc)
        idc,
        segmentacion
      FROM gestiones
      WHERE idc = ANY($1::text[])
        AND segmentacion IS NOT NULL
      ORDER BY
        idc,
        fecha_hora DESC
    `,
    [idcs],
  );

  for (const fila of filas) {
    mapa.set(fila.idc, fila.segmentacion);
  }

  for (const idc of idcs) {
    if (!mapa.has(idc)) {
      mapa.set(idc, null);
    }
  }

  return mapa;
}

async function agruparPorCliente(cuentas: CuentaBusqueda[]) {
  const porIdc = new Map<string, CuentaBusqueda[]>();

  for (const cuenta of cuentas) {
    const lista = porIdc.get(cuenta.idc) ?? [];

    lista.push(cuenta);

    porIdc.set(cuenta.idc, lista);
  }

  const idcs = Array.from(porIdc.keys());

  const segmentaciones = await obtenerSegmentacionesRecientes(idcs);

  return Array.from(porIdc.entries()).map(([idc, lista]) => ({
    idc,

    cliente: lista[0].cliente,

    cantidadCuentas: lista.length,

    montoDeudaTotal: lista.reduce(
      (suma, cuenta) => suma + (cuenta.mtodeuda_sol ?? 0),
      0,
    ),

    primeraCuenta: lista[0].codcuentacobranza,

    segmentacion: segmentaciones.get(idc) ?? null,
  }));
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

  try {
    const q = validarTextoBusqueda(request.nextUrl.searchParams.get("q"));

    if (/^\d+$/.test(q)) {
      const cuentas = await consultarFilas<CuentaBusqueda>(
        "SELECT codcuentacobranza, idc, cliente, mtodeuda_sol FROM cuentas WHERE idc = $1 AND activo = 1",
        [q],
      );
      const resultados = await agruparPorCliente(cuentas);
      return NextResponse.json({
        query: q,
        total: resultados.length,
        resultados,
      });
    }

    const todasLasCuentas = await consultarFilas<CuentaBusqueda>(
      "SELECT codcuentacobranza, idc, LEFT(cliente, " +
      (MAX_LONGITUD_NOMBRE + 1) +
      ") AS cliente, " +
      "mtodeuda_sol FROM cuentas WHERE activo = 1 LIMIT " +
      (MAX_CANDIDATOS_BUSQUEDA + 1),
    );
    if (todasLasCuentas.length > MAX_CANDIDATOS_BUSQUEDA) {
      throw new ErrorLimiteBusqueda(
        "La cartera supera el límite de esta búsqueda. Consulta al cliente por IDC.",
      );
    }

    const presupuesto = crearPresupuestoBusqueda();
    const distancias = new Map<string, number>();
    const umbral = 3 * q.split(/\s+/).length;
    const conSimilitud = todasLasCuentas
      .map((cuenta) => {
        let distancia = distancias.get(cuenta.cliente);
        if (distancia === undefined) {
          distancia = similitudNombreAcotada(q, cuenta.cliente, presupuesto);
          distancias.set(cuenta.cliente, distancia);
        }
        return { cuenta, distancia };
      })
      .filter((resultado) => resultado.distancia <= umbral)
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 100);

    const cuentas = conSimilitud.map((resultado) => resultado.cuenta);
    const resultados = (await agruparPorCliente(cuentas)).slice(0, 30);
    return NextResponse.json({
      query: q,
      total: resultados.length,
      resultados,
    });
  } catch (error) {
    if (
      error instanceof ErrorParametroBusqueda ||
      error instanceof ErrorLimiteBusqueda
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof ErrorParametroBusqueda ? 400 : 422 },
      );
    }
    throw error;
  }
}
