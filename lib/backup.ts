// lib/backup.ts
//
// Creación y rotación de respaldos PostgreSQL.
//
// Usa pg_dump en formato custom (.dump).
// Conserva como máximo los 30 respaldos más recientes.

import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const ejecutarArchivo = promisify(execFile);

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");

const RESPALDOS_A_CONSERVAR = 30;

function formatearFechaParaNombre(): string {
  const ahora = new Date();

  const pad = (numero: number) => String(numero).padStart(2, "0");

  return [
    ahora.getFullYear(),

    "-",

    pad(ahora.getMonth() + 1),

    "-",

    pad(ahora.getDate()),

    "_",

    pad(ahora.getHours()),

    "-",

    pad(ahora.getMinutes()),

    "-",

    pad(ahora.getSeconds()),
  ].join("");
}

function obtenerConfiguracionPostgres() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL. Revisa .env.local.");
  }

  const url = new URL(databaseUrl);

  const baseDatos = url.pathname.replace(/^\//, "");

  if (!baseDatos) {
    throw new Error("DATABASE_URL no contiene el nombre de la base de datos.");
  }

  const usuario = decodeURIComponent(url.username);

  const password = decodeURIComponent(url.password);

  const host = url.hostname;

  const puerto = url.port || "5432";

  return {
    host,
    puerto,
    usuario,
    password,
    baseDatos,

    sslMode: url.searchParams.get("sslmode"),
  };
}

function listarArchivosDeRespaldo() {
  if (!fs.existsSync(CARPETA_RESPALDOS)) {
    return [];
  }

  return fs
    .readdirSync(CARPETA_RESPALDOS)
    .filter(
      (archivo) =>
        archivo.startsWith("gestion-oficina_") && archivo.endsWith(".dump"),
    )
    .map((nombre) => {
      const ruta = path.join(CARPETA_RESPALDOS, nombre);

      const stats = fs.statSync(ruta);

      return {
        nombre,
        ruta,

        fechaModificacion: stats.mtime.getTime(),
      };
    })
    .sort((a, b) => b.fechaModificacion - a.fechaModificacion);
}

function rotarRespaldosViejos() {
  const archivos = listarArchivosDeRespaldo();

  if (archivos.length <= RESPALDOS_A_CONSERVAR) {
    return;
  }

  const archivosAEliminar = archivos.slice(RESPALDOS_A_CONSERVAR);

  for (const archivo of archivosAEliminar) {
    fs.unlinkSync(archivo.ruta);

    console.log(`[backup] Respaldo antiguo eliminado: ${archivo.nombre}`);
  }
}

export async function crearRespaldoBaseDatos(): Promise<{
  nombre: string;
  tamanoMB: number;
}> {
  if (!fs.existsSync(CARPETA_RESPALDOS)) {
    fs.mkdirSync(CARPETA_RESPALDOS, {
      recursive: true,
    });
  }

  const { host, puerto, usuario, password, baseDatos, sslMode } =
    obtenerConfiguracionPostgres();

  const nombreArchivo = `gestion-oficina_${formatearFechaParaNombre()}.dump`;

  const rutaDestino = path.join(CARPETA_RESPALDOS, nombreArchivo);

  /*
   * Si PostgreSQL no está en PATH,
   * podemos definir PG_DUMP_PATH en .env.local.
   *
   * Ejemplo:
   *
   * PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
   */

  const pgDump = process.env.PG_DUMP_PATH || "pg_dump";

  const argumentos = [
    "--host",
    host,

    "--port",
    puerto,

    "--username",
    usuario,

    "--dbname",
    baseDatos,

    "--format=custom",

    "--no-owner",

    "--no-privileges",

    "--file",
    rutaDestino,
  ];

  const entorno: NodeJS.ProcessEnv = {
    ...process.env,

    PGPASSWORD: password,
  };

  if (sslMode) {
    entorno.PGSSLMODE = sslMode;
  }

  try {
    await ejecutarArchivo(pgDump, argumentos, {
      env: entorno,

      windowsHide: true,
    });
  } catch (error) {
    /*
     * Si pg_dump alcanzó a crear un archivo
     * incompleto, no lo dejamos como backup válido.
     */

    if (fs.existsSync(rutaDestino)) {
      fs.unlinkSync(rutaDestino);
    }

    throw error;
  }

  if (!fs.existsSync(rutaDestino)) {
    throw new Error("pg_dump terminó sin crear el archivo de respaldo.");
  }

  const stats = fs.statSync(rutaDestino);

  if (stats.size === 0) {
    fs.unlinkSync(rutaDestino);

    throw new Error("pg_dump generó un respaldo vacío.");
  }

  rotarRespaldosViejos();

  const tamanoMB = Number((stats.size / (1024 * 1024)).toFixed(2));

  return {
    nombre: nombreArchivo,

    tamanoMB,
  };
}
