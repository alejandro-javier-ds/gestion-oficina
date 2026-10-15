import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";

import { copiarRespaldoABlob, type ResultadoCopia } from "./backup-blob";
import { diagnosticarErrorRespaldo } from "./backup-error";
import {
  crearRespaldoLocalValidado,
  type EjecutarComandoRespaldo,
} from "./backup-archivo";
import { conBloqueoRespaldo } from "./backup-lock";

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");
const RESPALDOS_A_CONSERVAR = 30;

export type ResultadoCopiaBlobRespaldo =
  | { estado: "verificada"; resultado: ResultadoCopia }
  | { estado: "pendiente"; codigo: string; estadoHttp?: number };

export type ResultadoRespaldo = {
  nombre: string;
  tamanoMB: number;
  localOk: true;
  copiaBlob: ResultadoCopiaBlobRespaldo;
};

type EjecutarConBloqueo = <T>(
  databaseUrl: string,
  tarea: () => Promise<T>,
) => Promise<T>;

type DependenciasServicioRespaldo = {
  databaseUrl: () => string | undefined;
  carpetaRespaldos: string;
  pgDump: string;
  pgRestore: string;
  ejecutar: EjecutarComandoRespaldo;
  copiarABlob: (ruta: string) => Promise<ResultadoCopia>;
  ejecutarConBloqueo: EjecutarConBloqueo;
  crearNombre: () => string;
  rotar: (carpeta: string, copiar: (ruta: string) => Promise<ResultadoCopia>) => Promise<void>;
  carpetaTemporal: string;
};

function formatearFechaParaNombre() {
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

function obtenerConfiguracionPostgres(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const baseDatos = url.pathname.replace(/^\//, "");

  if (!baseDatos) {
    throw Object.assign(
      new Error("DATABASE_URL no contiene el nombre de la base de datos."),
      { code: "InvalidDatabaseUrl" },
    );
  }

  return {
    host: url.hostname,
    puerto: url.port || "5432",
    usuario: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    baseDatos,
    sslMode: url.searchParams.get("sslmode"),
  };
}

function crearEntornoBase() {
  const entorno: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "production",
  };
  const variablesPermitidas = [
    "PATH",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "PGSSLROOTCERT",
    "PGSSLCERT",
    "PGSSLKEY",
    "PGSSLCRL",
    "PGSSLCRLDIR",
    "PGGSSENCMODE",
  ];

  for (const variable of variablesPermitidas) {
    const valor = process.env[variable];
    if (valor !== undefined) entorno[variable] = valor;
  }

  return entorno;
}

function resolverPgRestore(pgDump: string) {
  const configurado = process.env.PG_RESTORE_PATH?.trim();
  if (configurado) return configurado;

  const dumpConfigurado = process.env.PG_DUMP_PATH?.trim();
  if (!dumpConfigurado) return "pg_restore";

  const nombre = path.basename(pgDump);
  const nombreRestore = nombre.replace(/^pg_dump(?=\.exe$|$)/i, "pg_restore");
  if (nombreRestore === nombre) return "pg_restore";
  return path.join(path.dirname(pgDump), nombreRestore);
}

function ejecutarComando(
  ejecutable: string,
  argumentos: string[],
  entorno: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolver, rechazar) => {
    execFile(
      ejecutable,
      argumentos,
      { env: entorno, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error) => (error ? rechazar(error) : resolver()),
    );
  });
}

function listarArchivosDeRespaldo(carpeta = CARPETA_RESPALDOS) {
  if (!fs.existsSync(carpeta)) return [];

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
      return { nombre, ruta, fechaModificacion: stats.mtime.getTime() };
    })
    .filter((archivo): archivo is NonNullable<typeof archivo> => archivo !== null)
    .sort((a, b) => b.fechaModificacion - a.fechaModificacion);
}

export async function rotarRespaldosViejos(
  carpeta = CARPETA_RESPALDOS,
  conservar = RESPALDOS_A_CONSERVAR,
  copiar: (ruta: string) => Promise<ResultadoCopia> = copiarRespaldoABlob,
) {
  const archivos = listarArchivosDeRespaldo(carpeta);
  if (archivos.length <= conservar) return;

  for (const archivo of archivos.slice(conservar)) {
    try {
      const resultado = await copiar(archivo.ruta);
      if (resultado !== "copiado" && resultado !== "existente") {
        throw Object.assign(new Error("No se verificó la copia remota."), {
          code: "BlobVerificationFailed",
        });
      }
    } catch (error) {
      console.error(
        `[backup] Se conserva ${archivo.nombre}; no hay copia Blob verificada.`,
        diagnosticarErrorRespaldo(error),
      );
      continue;
    }

    try {
      fs.unlinkSync(archivo.ruta);
    } catch (error) {
      console.error(`[backup] No se pudo rotar ${archivo.nombre}.`,
        diagnosticarErrorRespaldo(error),
      );
      continue;
    }

    console.log(`[backup] Respaldo antiguo eliminado tras verificar Blob: ${archivo.nombre}`);
  }
}

const dependenciasPredeterminadas: DependenciasServicioRespaldo = {
  databaseUrl: () => process.env.DATABASE_URL,
  carpetaRespaldos: CARPETA_RESPALDOS,
  pgDump: process.env.PG_DUMP_PATH || "pg_dump",
  pgRestore: resolverPgRestore(process.env.PG_DUMP_PATH || "pg_dump"),
  ejecutar: ejecutarComando,
  copiarABlob: copiarRespaldoABlob,
  ejecutarConBloqueo: conBloqueoRespaldo,
  crearNombre: () =>
    `gestion-oficina_${formatearFechaParaNombre()}_${randomUUID()}.dump`,
  rotar: (carpeta, copiar) =>
    rotarRespaldosViejos(carpeta, RESPALDOS_A_CONSERVAR, copiar),
  carpetaTemporal: os.tmpdir(),
};

export function crearServicioDeRespaldos(
  overrides: Partial<DependenciasServicioRespaldo> = {},
) {
  const dependencias = { ...dependenciasPredeterminadas, ...overrides };

  return {
    async crearRespaldoBaseDatos(): Promise<ResultadoRespaldo> {
      const databaseUrl = dependencias.databaseUrl();
      if (!databaseUrl) {
        throw Object.assign(new Error("Falta DATABASE_URL."), {
          code: "DatabaseUrlMissing",
        });
      }

      const configuracion = obtenerConfiguracionPostgres(databaseUrl);

      return dependencias.ejecutarConBloqueo(databaseUrl, async () => {
        const entornoBase = crearEntornoBase();
        const entornoPgDump: NodeJS.ProcessEnv = {
          ...entornoBase,
          PGPASSWORD: configuracion.password,
          ...(configuracion.sslMode ? { PGSSLMODE: configuracion.sslMode } : {}),
        };
        const argumentosPgDump = [
          "--host",
          configuracion.host,
          "--port",
          configuracion.puerto,
          "--username",
          configuracion.usuario,
          "--dbname",
          configuracion.baseDatos,
          "--no-owner",
          "--no-privileges",
        ];

        const archivo = await crearRespaldoLocalValidado({
          carpetaRespaldos: dependencias.carpetaRespaldos,
          nombreArchivo: dependencias.crearNombre(),
          pgDump: dependencias.pgDump,
          pgRestore: dependencias.pgRestore,
          argumentosPgDump,
          entornoPgDump,
          entornoPgRestore: entornoBase,
          ejecutar: dependencias.ejecutar,
          carpetaTemporal: dependencias.carpetaTemporal,
        });

        console.log(
          `[backup] Respaldo local verificado: ${archivo.nombre} (${archivo.tamanoBytes} bytes).`,
        );

        let copiaBlob: ResultadoCopiaBlobRespaldo;
        try {
          const resultado = await dependencias.copiarABlob(archivo.ruta);
          copiaBlob = { estado: "verificada", resultado };
          console.log(`[backup Blob] Copia verificada: ${archivo.nombre} (${resultado}).`);
        } catch (error) {
          const diagnostico = diagnosticarErrorRespaldo(error);
          copiaBlob = { estado: "pendiente", ...diagnostico };
          console.error(
            `[backup Blob] Copia pendiente; se conserva el respaldo local ${archivo.nombre}.`,
            diagnostico,
          );
        }

        try {
          await dependencias.rotar(
            dependencias.carpetaRespaldos,
            dependencias.copiarABlob,
          );
        } catch (error) {
          console.error("[backup] No se pudo completar la rotación de respaldos.",
            diagnosticarErrorRespaldo(error),
          );
        }

        return {
          nombre: archivo.nombre,
          tamanoMB: Number((archivo.tamanoBytes / (1024 * 1024)).toFixed(2)),
          localOk: true,
          copiaBlob,
        };
      });
    },
  };
}

const servicioPredeterminado = crearServicioDeRespaldos();

export async function crearRespaldoBaseDatos() {
  return servicioPredeterminado.crearRespaldoBaseDatos();
}
