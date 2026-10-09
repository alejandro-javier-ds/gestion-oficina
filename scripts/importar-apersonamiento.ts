// scripts/importar-apersonamiento.ts

import fs from "fs";

import { importarApersonamientoDesdeBuffer } from "../lib/importar-apersonamiento";

async function main(): Promise<void> {
  const rutaArchivo = process.argv[2];

  if (!rutaArchivo) {
    console.error(
      "Falta la ruta del Excel. Uso: npx tsx scripts/importar-apersonamiento.ts <ruta>",
    );

    process.exitCode = 1;
    return;
  }

  const buffer = fs.readFileSync(rutaArchivo);

  const resumen = await importarApersonamientoDesdeBuffer(buffer);

  if (!resumen.hojaEncontrada) {
    console.log(
      'Este Excel no tiene hoja "Apersonamiento" — nada que importar.',
    );

    return;
  }

  console.log(
    `Leídas ${resumen.totalFilasLeidas} filas de la hoja Apersonamiento.`,
  );

  console.log(
    `${resumen.filasPermitidas} filas pertenecen a los IDC activos del portafolio.`,
  );

  console.log(
    `--- Importación completa: ${resumen.registrosGuardados} registros de apersonamiento guardados. ---`,
  );
}

main().catch((error) => {
  console.error("Error importando apersonamiento:", error);

  process.exitCode = 1;
});
