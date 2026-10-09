// scripts/importar-telefonos.ts

import fs from "fs";

import { importarTelefonosDesdeBuffer } from "../lib/importar-telefonos";

async function main(): Promise<void> {
  const rutaArchivo = process.argv[2];

  if (!rutaArchivo) {
    console.error(
      "Falta la ruta del Excel. Uso: npx tsx scripts/importar-telefonos.ts <ruta>",
    );

    process.exitCode = 1;
    return;
  }

  const buffer = fs.readFileSync(rutaArchivo);

  const resumen = await importarTelefonosDesdeBuffer(buffer);

  if (!resumen.hojaEncontrada) {
    console.log('Este Excel no tiene hoja "Telefonos" — nada que importar.');

    return;
  }

  console.log(`Leídas ${resumen.totalFilasLeidas} filas de la hoja Telefonos.`);

  console.log(
    `${resumen.filasPermitidas} filas pertenecen a los IDC activos del portafolio.`,
  );

  console.log(
    `--- Importación completa: ${resumen.telefonosGuardados} teléfonos guardados. ---`,
  );
}

main().catch((error) => {
  console.error("Error importando teléfonos:", error);

  process.exitCode = 1;
});
