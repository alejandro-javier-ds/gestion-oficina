// app/api/buscar/route.ts

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import { Cuenta } from "@/lib/types";

function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similitudNombre(busqueda: string, nombreCompleto: string): number {
  const palabrasBusqueda = busqueda.toLowerCase().trim().split(/\s+/);
  const palabrasNombre = nombreCompleto.toLowerCase().trim().split(/\s+/);
  let distanciaTotal = 0;
  for (const palabraB of palabrasBusqueda) {
    let mejorDistancia = Infinity;
    for (const palabraN of palabrasNombre) {
      const d = distanciaLevenshtein(palabraB, palabraN);
      if (d < mejorDistancia) mejorDistancia = d;
    }
    distanciaTotal += mejorDistancia;
  }
  return distanciaTotal;
}

function obtenerSegmentacionesRecientes(
  idcs: string[],
): Map<string, string | null> {
  const mapa = new Map<string, string | null>();
  const consulta = db.prepare(
    `SELECT segmentacion FROM gestiones WHERE idc = ? AND segmentacion IS NOT NULL ORDER BY fecha_hora DESC LIMIT 1`,
  );
  for (const idc of idcs) {
    const fila = consulta.get(idc) as { segmentacion: string } | undefined;
    mapa.set(idc, fila?.segmentacion ?? null);
  }
  return mapa;
}

function agruparPorCliente(cuentas: Cuenta[]) {
  const porIdc = new Map<string, Cuenta[]>();
  for (const c of cuentas) {
    const lista = porIdc.get(c.idc) ?? [];
    lista.push(c);
    porIdc.set(c.idc, lista);
  }

  const idcs = Array.from(porIdc.keys());
  const segmentaciones = obtenerSegmentacionesRecientes(idcs);

  return Array.from(porIdc.entries()).map(([idc, lista]) => ({
    idc,
    cliente: lista[0].cliente,
    cantidadCuentas: lista.length,
    montoDeudaTotal: lista.reduce((suma, c) => suma + (c.mtodeuda_sol ?? 0), 0),
    primeraCuenta: lista[0].codcuentacobranza,
    segmentacion: segmentaciones.get(idc) ?? null,
  }));
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Falta el parámetro q" },
      { status: 400 },
    );
  }

  const restriccionGestor = sesion.rol === "gestor" ? "AND gestor = ?" : "";
  const parametroGestor = sesion.rol === "gestor" ? [sesion.gestor] : [];

  const esSoloNumeros = /^\d+$/.test(q);

  if (esSoloNumeros) {
    const cuentas = db
      .prepare(
        `SELECT * FROM cuentas WHERE idc = ? AND activo = 1 ${restriccionGestor}`,
      )
      .all(q, ...parametroGestor) as Cuenta[];
    const resultados = agruparPorCliente(cuentas);
    return NextResponse.json({
      query: q,
      total: resultados.length,
      resultados,
    });
  }

  const todasLasCuentas = db
    .prepare(`SELECT * FROM cuentas WHERE activo = 1 ${restriccionGestor}`)
    .all(...parametroGestor) as Cuenta[];

  const UMBRAL_MAXIMO = 3;

  const conSimilitud = todasLasCuentas
    .map((c) => ({ cuenta: c, distancia: similitudNombre(q, c.cliente) }))
    .filter((r) => r.distancia <= UMBRAL_MAXIMO * q.trim().split(/\s+/).length)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 100);

  const cuentas = conSimilitud.map((r) => r.cuenta);
  const resultados = agruparPorCliente(cuentas).slice(0, 30);

  return NextResponse.json({ query: q, total: resultados.length, resultados });
}
