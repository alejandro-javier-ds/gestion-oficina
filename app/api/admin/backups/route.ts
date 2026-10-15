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
import { diagnosticarErrorRespaldo } from "@/lib/backup-error";

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
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
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

      const stats = fs.lstatSync(ruta);
      if (!stats.isFile() || stats.size === 0) return null;

      return {
        nombre,

        tamanoMB: Number((stats.size / (1024 * 1024)).toFixed(2)),

        fecha: stats.mtime.toISOString(),
      };
    })
    .filter((respaldo): respaldo is NonNullable<typeof respaldo> => respaldo !== null)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return NextResponse.json({
    respaldos,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
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
    const resultado = await crearRespaldoBaseDatos();
    const blobOk = resultado.copiaBlob.estado === "verificada";

    return NextResponse.json({
      ok: blobOk,
      localOk: resultado.localOk,
      blobOk,
      nombre: resultado.nombre,
      tamanoMB: resultado.tamanoMB,
      copiaBlob: resultado.copiaBlob,
    }, {
      status: blobOk ? 200 : 502,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const diagnostico = diagnosticarErrorRespaldo(error);
    console.error("[backup] No se pudo crear un respaldo verificado.", diagnostico);

    return NextResponse.json(
      {
        ok: false,
        localOk: false,
        blobOk: false,
        error: "No se pudo crear el respaldo de PostgreSQL.",
        codigo: diagnostico.codigo,
      },
      {
        status: diagnostico.codigo === "BackupInProgress" ? 409 : 500,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
