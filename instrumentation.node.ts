import { diagnosticarErrorRespaldo } from "./lib/backup-error";

const estadoGlobal = globalThis as typeof globalThis & {
  __gestionOficinaBackupScheduler?: Promise<void>;
};

export async function registrarInstrumentacionNode() {
  if (estadoGlobal.__gestionOficinaBackupScheduler) {
    return estadoGlobal.__gestionOficinaBackupScheduler;
  }

  const registro = registrarProgramador();
  estadoGlobal.__gestionOficinaBackupScheduler = registro;
  try {
    await registro;
  } catch (error) {
    if (estadoGlobal.__gestionOficinaBackupScheduler === registro) {
      delete estadoGlobal.__gestionOficinaBackupScheduler;
    }
    throw error;
  }
}

async function registrarProgramador() {
  const cron = await import("node-cron");
  const { crearRespaldoBaseDatos } = await import("./lib/backup");
  const opciones = { timezone: "America/Lima", noOverlap: true };

  async function ejecutarRespaldoProgramado(etiqueta: string) {
    console.log(`[backup automático] Iniciando respaldo programado (${etiqueta}).`);

    try {
      const resultado = await crearRespaldoBaseDatos();
      if (resultado.copiaBlob.estado === "verificada") {
        console.log(
          `[backup automático] Respaldo local y copia Blob verificados: ${resultado.nombre} (${resultado.tamanoMB} MB).`,
        );
      } else {
        console.error(
          `[backup automático] Respaldo local verificado; copia Blob pendiente: ${resultado.nombre}.`,
          {
            codigo: resultado.copiaBlob.codigo,
            estadoHttp: resultado.copiaBlob.estadoHttp,
          },
        );
      }
    } catch (error) {
      const diagnostico = diagnosticarErrorRespaldo(error);
      if (diagnostico.codigo === "BackupInProgress") {
        console.log("[backup automático] Se omitió la ejecución; ya hay un respaldo en curso.");
      } else {
        console.error(
          `[backup automático] No se pudo completar el respaldo (${etiqueta}).`,
          diagnostico,
        );
      }
    }
  }

  cron.schedule("0 17 * * 1", () => ejecutarRespaldoProgramado("lunes 5pm"), opciones);
  cron.schedule("0 17 * * 4", () => ejecutarRespaldoProgramado("jueves 5pm"), opciones);

  console.log(
    "[backup automático] Programador iniciado; respaldos lunes y jueves a las 5:00 p. m. (hora de Lima).",
  );
}
