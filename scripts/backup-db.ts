// scripts/backup-db.ts
// Crea un respaldo manual, desde la terminal.

import { crearRespaldoBaseDatos } from "../lib/backup";

crearRespaldoBaseDatos()
  .then((resultado) => {
    console.log(
      `Respaldo local creado y validado: ${resultado.nombre} (${resultado.tamanoMB} MB).`,
    );
    if (resultado.copiaBlob.estado === "verificada") {
      console.log(`Copia de Azure Blob verificada: ${resultado.copiaBlob.resultado}.`);
    } else {
      console.error("La copia de Azure Blob quedó pendiente; el archivo local se conserva.", {
        codigo: resultado.copiaBlob.codigo,
        estadoHttp: resultado.copiaBlob.estadoHttp,
      });
      process.exitCode = 2;
    }
  })
  .catch((error) => {
    console.error("No se pudo crear un respaldo verificado.", {
      code:
        typeof error?.code === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(error.code)
          ? error.code
          : "BackupFailed",
    });
    process.exit(1);
  });
