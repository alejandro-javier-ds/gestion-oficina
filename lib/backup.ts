// lib/backup.ts
// Lógica real de crear un respaldo

import fs from "fs";
import path from "path";
import db from "./db";

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
    console.log(`[backup] Respaldo antiguo eliminado: ${archivo.nombre}`);
  }
}

export async function crearRespaldoBaseDatos(): Promise<{
  nombre: string;
  tamanoMB: number;
}> {
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

  return { nombre: nombreArchivo, tamanoMB };
}
