// app/api/admin/backups/route.ts
// GET: lista los respaldos existentes en /backups. POST: crea uno nuevo

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");
const RESPALDOS_A_CONSERVAR = 30;

function formatearFechaParaNombre(): string {
  const ahora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}-${pad(ahora.getSeconds())}`;
}

function rotarRespaldosViejos() {
  const archivos = fs
    .readdirSync(CARPETA_RESPALDOS)
    .filter((f) => f.startsWith("gestion-oficina_") && f.endsWith(".db"))
    .map((f) => ({
      nombre: f,
      ruta: path.join(CARPETA_RESPALDOS, f),
      fechaModificacion: fs
        .statSync(path.join(CARPETA_RESPALDOS, f))
        .mtime.getTime(),
    }))
    .sort((a, b) => b.fechaModificacion - a.fechaModificacion);

  if (archivos.length <= RESPALDOS_A_CONSERVAR) return;

  for (const archivo of archivos.slice(RESPALDOS_A_CONSERVAR)) {
    fs.unlinkSync(archivo.ruta);
  }
}

export async function GET() {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (sesion.rol !== "administrador" && sesion.rol !== "supervisor") {
    return NextResponse.json(
      { error: "Tu rol no tiene acceso a esto." },
      { status: 403 },
    );
  }

  if (!fs.existsSync(CARPETA_RESPALDOS)) {
    return NextResponse.json({ respaldos: [] });
  }

  const respaldos = fs
    .readdirSync(CARPETA_RESPALDOS)
    .filter((f) => f.startsWith("gestion-oficina_") && f.endsWith(".db"))
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

  return NextResponse.json({ respaldos });
}

export async function POST() {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (sesion.rol !== "administrador" && sesion.rol !== "supervisor") {
    return NextResponse.json(
      { error: "Tu rol no tiene acceso a esto." },
      { status: 403 },
    );
  }

  if (!fs.existsSync(CARPETA_RESPALDOS)) {
    fs.mkdirSync(CARPETA_RESPALDOS, { recursive: true });
  }

  const nombreArchivo = `gestion-oficina_${formatearFechaParaNombre()}.db`;
  const rutaDestino = path.join(CARPETA_RESPALDOS, nombreArchivo);

  await db.backup(rutaDestino);
  rotarRespaldosViejos();

  const tamanoMB = Number(
    (fs.statSync(rutaDestino).size / (1024 * 1024)).toFixed(2),
  );

  return NextResponse.json({ ok: true, nombre: nombreArchivo, tamanoMB });
}
