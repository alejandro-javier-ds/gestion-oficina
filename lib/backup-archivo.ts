import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";

export type EjecutarComandoRespaldo = (
  ejecutable: string,
  argumentos: string[],
  entorno: NodeJS.ProcessEnv,
) => Promise<void>;

export type OpcionesRespaldoArchivo = {
  carpetaRespaldos: string;
  nombreArchivo: string;
  pgDump: string;
  pgRestore: string;
  argumentosPgDump: string[];
  entornoPgDump: NodeJS.ProcessEnv;
  entornoPgRestore: NodeJS.ProcessEnv;
  ejecutar: EjecutarComandoRespaldo;
  carpetaTemporal?: string;
};

export type ArchivoRespaldoValidado = {
  nombre: string;
  ruta: string;
  tamanoBytes: number;
  sha256: string;
};

function crearError(codigo: string, mensaje: string) {
  return Object.assign(new Error(mensaje), { code: codigo });
}

function codigoError(error: unknown) {
  const codigo = (error as NodeJS.ErrnoException | null)?.code;
  return typeof codigo === "string" ? codigo : "BackupFileOperationFailed";
}

async function existe(ruta: string) {
  try {
    await fs.lstat(ruta);
    return true;
  } catch (error) {
    if (codigoError(error) === "ENOENT") return false;
    throw error;
  }
}

async function calcularSha256(ruta: string) {
  const hash = createHash("sha256");
  for await (const bloque of createReadStream(ruta)) hash.update(bloque);
  return hash.digest("hex");
}

async function validarArchivo(ruta: string, esperado?: { tamanoBytes: number }) {
  const stats = await fs.lstat(ruta);
  if (!stats.isFile() || stats.size === 0) {
    throw crearError("InvalidBackupArchive", "El respaldo no es un archivo válido.");
  }
  if (esperado && stats.size !== esperado.tamanoBytes) {
    throw crearError(
      "BackupSizeMismatch",
      "El tamaño del respaldo cambió durante la copia.",
    );
  }
  return stats;
}

function decodificarRutaMontaje(ruta: string) {
  return ruta
    .replace(/\\040/g, " ")
    .replace(/\\011/g, "\t")
    .replace(/\\012/g, "\n")
    .replace(/\\134/g, "\\");
}

export function validarMontajePersistenteRespaldos(
  carpetaRespaldos: string,
  informacionMontajes: string,
) {
  const rutaEsperada = path.resolve(carpetaRespaldos);
  const tiposPersistentes = new Set(["cifs", "smb3", "nfs", "nfs4"]);

  for (const linea of informacionMontajes.split("\n")) {
    const [ladoMontaje, ladoSistema] = linea.split(" - ");
    if (!ladoMontaje || !ladoSistema) continue;
    const camposMontaje = ladoMontaje.split(" ");
    const rutaMontaje = decodificarRutaMontaje(camposMontaje[4] ?? "");
    if (path.resolve(rutaMontaje) !== rutaEsperada) continue;

    const opciones = new Set((camposMontaje[5] ?? "").split(","));
    const tipo = ladoSistema.split(" ")[0];
    if (!tiposPersistentes.has(tipo)) {
      throw crearError(
        "BackupVolumeNotPersistent",
        "El volumen de respaldos no usa un sistema de archivos persistente compatible.",
      );
    }
    if (!opciones.has("rw")) {
      throw crearError(
        "BackupVolumeReadOnly",
        "El volumen de respaldos no está montado para escritura.",
      );
    }
    return;
  }

  throw crearError(
    "BackupVolumeNotMounted",
    "El volumen persistente de respaldos no está montado en la ruta esperada.",
  );
}

async function verificarVolumenRespaldos(carpetaRespaldos: string) {
  if (!process.env.CONTAINER_APP_NAME) return;

  let informacionMontajes: string;
  try {
    informacionMontajes = await fs.readFile("/proc/self/mountinfo", "utf8");
  } catch {
    throw crearError(
      "BackupVolumeNotMounted",
      "No se pudo comprobar el montaje persistente de respaldos.",
    );
  }

  validarMontajePersistenteRespaldos(carpetaRespaldos, informacionMontajes);
}

async function verificarArchivo(
  ruta: string,
  pgRestore: string,
  entorno: NodeJS.ProcessEnv,
  ejecutar: EjecutarComandoRespaldo,
) {
  try {
    await ejecutar(pgRestore, ["--list", ruta], entorno);
  } catch {
    throw crearError(
      "InvalidBackupArchive",
      "pg_restore no pudo validar el archivo de respaldo.",
    );
  }
}

async function copiarContenido(origen: string, archivo: FileHandle) {
  for await (const bloque of createReadStream(origen)) {
    let desplazamiento = 0;
    while (desplazamiento < bloque.length) {
      const resultado = await archivo.write(
        bloque,
        desplazamiento,
        bloque.length - desplazamiento,
        null,
      );
      if (resultado.bytesWritten <= 0) {
        throw crearError("BackupFileWriteFailed", "No se completó la copia del respaldo.");
      }
      desplazamiento += resultado.bytesWritten;
    }
  }
  await archivo.sync();
}

async function limpiarArchivoTemporal(ruta: string | undefined) {
  if (!ruta) return;
  try {
    await fs.unlink(ruta);
  } catch (error) {
    if (codigoError(error) !== "ENOENT") {
      console.error("[backup] No se pudo limpiar un temporal de respaldo.", {
        codigo: codigoError(error),
      });
    }
  }
}

async function limpiarTemporalesAbandonados(
  carpetaRespaldos: string,
  carpetaTemporal: string,
) {
  const limite = Date.now() - 24 * 60 * 60 * 1000;
  const patronTemporalAzure =
    /^\.gestion-oficina_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[0-9a-f-]{36}\.dump\.[0-9a-f-]{36}\.partial$/;

  try {
    const nombres = await fs.readdir(carpetaRespaldos);
    for (const nombre of nombres) {
      if (!patronTemporalAzure.test(nombre)) continue;
      const ruta = path.join(carpetaRespaldos, nombre);
      try {
        const stats = await fs.lstat(ruta);
        if (stats.isFile() && stats.mtimeMs < limite) await fs.unlink(ruta);
      } catch (error) {
        if (codigoError(error) !== "ENOENT") {
          console.error("[backup] No se pudo limpiar un temporal remoto abandonado.", {
            codigo: codigoError(error),
          });
        }
      }
    }
  } catch (error) {
    if (codigoError(error) !== "ENOENT") {
      console.error("[backup] No se pudieron revisar temporales remotos abandonados.", {
        codigo: codigoError(error),
      });
    }
  }

  try {
    const nombres = await fs.readdir(carpetaTemporal);
    for (const nombre of nombres) {
      if (!nombre.startsWith("gestion-oficina-backup-")) continue;
      const ruta = path.join(carpetaTemporal, nombre);
      try {
        const stats = await fs.lstat(ruta);
        if (stats.isDirectory() && stats.mtimeMs < limite) {
          await fs.rm(ruta, { recursive: true, force: true });
        }
      } catch (error) {
        if (codigoError(error) !== "ENOENT") {
          console.error("[backup] No se pudo limpiar un temporal local abandonado.", {
            codigo: codigoError(error),
          });
        }
      }
    }
  } catch (error) {
    if (codigoError(error) !== "ENOENT") {
      console.error("[backup] No se pudieron revisar temporales locales abandonados.", {
        codigo: codigoError(error),
      });
    }
  }
}

export async function crearRespaldoLocalValidado(
  opciones: OpcionesRespaldoArchivo,
): Promise<ArchivoRespaldoValidado> {
  const {
    carpetaRespaldos,
    nombreArchivo,
    pgDump,
    pgRestore,
    argumentosPgDump,
    entornoPgDump,
    entornoPgRestore,
    ejecutar,
  } = opciones;

  if (
    path.basename(nombreArchivo) !== nombreArchivo ||
    !/^gestion-oficina_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[0-9a-f-]{36}\.dump$/.test(
      nombreArchivo,
    )
  ) {
    throw crearError("InvalidBackupName", "El nombre del respaldo no es válido.");
  }

  await verificarVolumenRespaldos(carpetaRespaldos);
  await fs.mkdir(carpetaRespaldos, { recursive: true, mode: 0o700 });
  const carpetaStats = await fs.lstat(carpetaRespaldos);
  if (!carpetaStats.isDirectory()) {
    throw crearError(
      "InvalidBackupDirectory",
      "La carpeta de respaldos no es un directorio válido.",
    );
  }

  const rutaDestino = path.join(carpetaRespaldos, nombreArchivo);
  if (await existe(rutaDestino)) {
    throw crearError(
      "BackupNameConflict",
      "Ya existe un respaldo con el nombre generado.",
    );
  }

  const carpetaTemporal = opciones.carpetaTemporal ?? os.tmpdir();
  await limpiarTemporalesAbandonados(carpetaRespaldos, carpetaTemporal);
  const directorioTrabajo = await fs.mkdtemp(
    path.join(carpetaTemporal, "gestion-oficina-backup-"),
  );
  const rutaTrabajo = path.join(directorioTrabajo, nombreArchivo);
  const rutaTemporalAzure = path.join(
    carpetaRespaldos,
    `.${nombreArchivo}.${randomUUID()}.partial`,
  );
  let temporalAzureCreado = false;

  try {
    const archivoTrabajo = await fs.open(rutaTrabajo, "wx", 0o600);
    await archivoTrabajo.close();

    if (process.platform === "linux") {
      const directorioStats = await fs.stat(directorioTrabajo);
      const archivoStats = await fs.stat(rutaTrabajo);
      if ((directorioStats.mode & 0o077) !== 0 || (archivoStats.mode & 0o077) !== 0) {
        throw crearError(
          "InsecureBackupTemporaryFile",
          "El temporal local no tiene permisos privados.",
        );
      }
    }

    try {
      await ejecutar(pgDump, [...argumentosPgDump, "--format=custom", "--file", rutaTrabajo], entornoPgDump);
    } catch {
      throw crearError("PgDumpFailed", "pg_dump no pudo crear el respaldo.");
    }

    const statsTrabajo = await validarArchivo(rutaTrabajo);
    await verificarArchivo(rutaTrabajo, pgRestore, entornoPgRestore, ejecutar);
    const sha256 = await calcularSha256(rutaTrabajo);

    const archivoTemporalAzure = await fs.open(rutaTemporalAzure, "wx", 0o600);
    temporalAzureCreado = true;
    try {
      await copiarContenido(rutaTrabajo, archivoTemporalAzure);
    } finally {
      await archivoTemporalAzure.close().catch(() => {});
    }

    const statsTemporalAzure = await validarArchivo(rutaTemporalAzure, {
      tamanoBytes: statsTrabajo.size,
    });
    const sha256Temporal = await calcularSha256(rutaTemporalAzure);
    if (sha256Temporal !== sha256) {
      throw crearError(
        "BackupIntegrityMismatch",
        "La copia del respaldo no coincide con el archivo validado.",
      );
    }

    await verificarArchivo(rutaTemporalAzure, pgRestore, entornoPgRestore, ejecutar);

    if (await existe(rutaDestino)) {
      throw crearError(
        "BackupNameConflict",
        "Ya existe un respaldo con el nombre generado.",
      );
    }

    try {
      await fs.rename(rutaTemporalAzure, rutaDestino);
      temporalAzureCreado = false;
    } catch (error) {
      if (await existe(rutaDestino)) {
        const statsDestino = await validarArchivo(rutaDestino, {
          tamanoBytes: statsTemporalAzure.size,
        }).catch(() => null);
        const sha256Destino = statsDestino
          ? await calcularSha256(rutaDestino).catch(() => "")
          : "";
        if (statsDestino && sha256Destino === sha256) {
          temporalAzureCreado = await existe(rutaTemporalAzure);
        } else {
          throw crearError(
            "BackupNameConflict",
            "No se publicó el respaldo para evitar sobrescribir otro archivo.",
          );
        }
      } else {
        throw crearError(
          codigoError(error),
          "No se pudo publicar el respaldo validado en Azure Files.",
        );
      }
    }

    return {
      nombre: nombreArchivo,
      ruta: rutaDestino,
      tamanoBytes: statsTemporalAzure.size,
      sha256,
    };
  } finally {
    if (temporalAzureCreado) await limpiarArchivoTemporal(rutaTemporalAzure);
    await fs.rm(directorioTrabajo, { recursive: true, force: true }).catch(() => {
      console.error("[backup] No se pudo limpiar el temporal local.", {
        codigo: "BackupTemporaryCleanupFailed",
      });
    });
  }
}
