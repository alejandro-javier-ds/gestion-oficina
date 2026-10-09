// scripts/importar-portafolio.ts
// Lee un Excel de portafolio desde disco y lo sincroniza con PostgreSQL.

import fs from "fs";
import path from "path";

import { importarPortafolioDesdeBuffer } from "../lib/importar-cuentas";

async function main(): Promise<void> {
  const rutaArchivo = process.argv[2];

  if (!rutaArchivo) {
    console.error(
      "Falta la ruta del Excel. Uso: npx tsx scripts/importar-portafolio.ts <ruta>",
    );

    process.exitCode = 1;
    return;
  }

  const nombreArchivo = path.basename(rutaArchivo);

  const buffer = fs.readFileSync(rutaArchivo);

  const resumen = await importarPortafolioDesdeBuffer(buffer, nombreArchivo);

  console.log(`Leídas ${resumen.totalFilasLeidas} filas del Excel.`);

  console.log(
    `${resumen.filasPermitidas} filas pertenecen a la cartera reconocida.`,
  );

  console.log("--- Resumen del import ---");

  console.log("Cuentas nuevas:", resumen.cuentasNuevas);

  console.log("Cuentas actualizadas:", resumen.cuentasActualizadas);

  console.log("Cuentas dadas de baja:", resumen.cuentasDadasDeBaja);
}

main().catch((error) => {
  console.error("Error importando portafolio:", error);

  process.exitCode = 1;
});
