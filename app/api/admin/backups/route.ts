// app/api/admin/backups/route.ts
//
// GET:
// Lista los respaldos PostgreSQL existentes.
//
// POST:
// Crea un nuevo respaldo PostgreSQL.
//
// Formato:
// gestion-oficina_YYYY-MM-DD_HH-MM-SS.dump

import { NextResponse } from "next/server";

import fs from "fs";
import path from "path";

import { leerSesionActual } from "@/lib/auth";

import { crearRespaldoBaseDatos } from "@/lib/backup";

export const runtime = "nodejs";

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");

function tieneAcceso(rol: string) {
  return rol === "administrador" || rol === "supervisor";
}

export async function GET() {
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

  if (!tieneAcceso(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene acceso a esto.",
      },
      {
        status: 403,
      },
    );
  }

  if (!fs.existsSync(CARPETA_RESPALDOS)) {
    return NextResponse.json({
      respaldos: [],
    });
  }

  const respaldos = fs
    .readdirSync(CARPETA_RESPALDOS)
    .filter(
      (nombre) =>
        nombre.startsWith("gestion-oficina_") && nombre.endsWith(".dump"),
    )
    .map((nombre) => {
      const ruta = path.join(CARPETA_RESPALDOS, nombre);

      const stats = fs.statSync(ruta);

      return {
        nombre,

        tamanoMB: Number((stats.size / (1024 * 1024)).toFixed(2)),

        fecha: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return NextResponse.json({
    respaldos,
  });
}

export async function POST() {
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

  if (!tieneAcceso(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene acceso a esto.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const { nombre, tamanoMB } = await crearRespaldoBaseDatos();

    return NextResponse.json({
      ok: true,
      nombre,
      tamanoMB,
    });
  } catch (error) {
    console.error("[backup] Error al crear respaldo PostgreSQL:", error);

    return NextResponse.json(
      {
        error: "No se pudo crear el respaldo de PostgreSQL.",
      },
      {
        status: 500,
      },
    );
  }
}
