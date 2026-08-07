// scripts/backup-db.ts
// Crea un respaldo manual, desde la terminal.

import { crearRespaldoBaseDatos } from "../lib/backup";

crearRespaldoBaseDatos()
  .then(({ nombre, tamanoMB }) => {
    console.log(`Respaldo creado correctamente: ${nombre} (${tamanoMB} MB)`);
  })
  .catch((error) => {
    console.error("Error al crear el respaldo:", error);
    process.exit(1);
  });
