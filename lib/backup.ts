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
import { randomUUID } from "node:crypto";
import { copiarRespaldoABlob } from "./backup-blob";

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

function listarArchivosDeRespaldo(carpeta = CARPETA_RESPALDOS) {
  if (!fs.existsSync(carpeta)) {
    return [];
  }

  return fs
    .readdirSync(carpeta)
    .filter(
      (archivo) =>
        archivo.startsWith("gestion-oficina_") && archivo.endsWith(".dump"),
    )
    .map((nombre) => {
      const ruta = path.join(carpeta, nombre);

      const stats = fs.lstatSync(ruta);
      if (!stats.isFile()) return null;

      return {
        nombre,
        ruta,

        fechaModificacion: stats.mtime.getTime(),
      };
    })
    .filter((archivo): archivo is NonNullable<typeof archivo> => archivo !== null)
    .sort((a, b) => b.fechaModificacion - a.fechaModificacion);
}

export async function rotarRespaldosViejos(
  carpeta = CARPETA_RESPALDOS,
  conservar = RESPALDOS_A_CONSERVAR,
  copiar = copiarRespaldoABlob,
) {
  const archivos = listarArchivosDeRespaldo(carpeta);

  if (archivos.length <= conservar) {
    return;
  }

  const archivosAEliminar = archivos.slice(conservar);

  for (const archivo of archivosAEliminar) {
    try {
      await copiar(archivo.ruta);
    } catch (error) {
      const datos = error as { code?: unknown; statusCode?: unknown } | null;
      const codigo = datos?.code;
      const estado = datos?.statusCode;
      console.error(
        `[backup] Se conserva ${archivo.nombre}; no hay copia Blob verificada.`,
        {
          codigo:
            typeof codigo === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(codigo)
              ? codigo
              : "BlobUploadFailed",
          estadoHttp: typeof estado === "number" ? estado : undefined,
        },
      );
      continue;
    }

    try {
      fs.unlinkSync(archivo.ruta);
    } catch (error) {
      console.error(`[backup] No se pudo rotar ${archivo.nombre}.`, {
        codigo: (error as NodeJS.ErrnoException).code ?? "FileDeleteFailed",
      });
      continue;
    }

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
      mode: 0o700,
    });
  }
  const carpetaStats = fs.lstatSync(CARPETA_RESPALDOS);
  if (!carpetaStats.isDirectory()) {
    throw new Error("La carpeta de respaldos debe ser un directorio local seguro.");
  }

  const { host, puerto, usuario, password, baseDatos, sslMode } =
    obtenerConfiguracionPostgres();

  const nombreArchivo = `gestion-oficina_${formatearFechaParaNombre()}_${randomUUID()}.dump`;

  const rutaTemporal = path.join(CARPETA_RESPALDOS, `${nombreArchivo}.partial`);
  const rutaDestino = path.join(CARPETA_RESPALDOS, nombreArchivo);
  const descriptorTemporal = fs.openSync(rutaTemporal, "wx", 0o600);
  fs.closeSync(descriptorTemporal);

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
    rutaTemporal,
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

    if (fs.existsSync(rutaTemporal)) {
      fs.unlinkSync(rutaTemporal);
    }

    throw error;
  }

  if (!fs.existsSync(rutaTemporal)) {
    throw new Error("pg_dump terminó sin crear el archivo de respaldo.");
  }

  const stats = fs.statSync(rutaTemporal);

  if (stats.size === 0) {
    fs.unlinkSync(rutaTemporal);

    throw new Error("pg_dump generó un respaldo vacío.");
  }

  fs.chmodSync(rutaTemporal, 0o600);
  fs.linkSync(rutaTemporal, rutaDestino);
  fs.unlinkSync(rutaTemporal);
  const statsFinales = fs.statSync(rutaDestino);

  try {
    const resultado = await copiarRespaldoABlob(rutaDestino);
    console.log(`[backup Blob] ${nombreArchivo}: ${resultado}.`);
  } catch (error) {
    const datos = error as { code?: unknown; statusCode?: unknown } | null;
    const codigoError = datos?.code ?? (error instanceof Error ? error.name : undefined);
    const codigo =
      typeof codigoError === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(codigoError)
        ? codigoError
        : "BlobUploadFailed";
    const estadoHttp =
      typeof datos?.statusCode === "number" ? datos.statusCode : undefined;
    console.error(
      `[backup Blob] No se pudo copiar ${nombreArchivo}; el respaldo local se conserva.`,
      { codigo, estadoHttp },
    );
  }

  await rotarRespaldosViejos();

  const tamanoMB = Number((statsFinales.size / (1024 * 1024)).toFixed(2));

  return {
    nombre: nombreArchivo,

    tamanoMB,
  };
}
