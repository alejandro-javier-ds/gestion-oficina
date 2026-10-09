// scripts/importar-garantias.ts

import fs from "fs";

import { importarGarantiasDesdeBuffer } from "../lib/importar-garantias";

async function main(): Promise<void> {
  const rutaArchivo = process.argv[2];

  if (!rutaArchivo) {
    console.error(
      "Falta la ruta del Excel. Uso: npx tsx scripts/importar-garantias.ts <ruta>",
    );

    process.exitCode = 1;
    return;
  }

  const buffer = fs.readFileSync(rutaArchivo);

  const resumen = await importarGarantiasDesdeBuffer(buffer);

  if (!resumen.hojaEncontrada) {
    console.log('Este Excel no tiene hoja "Garantias" — nada que importar.');

    return;
  }

  console.log(`Leídas ${resumen.totalFilasLeidas} filas de la hoja Garantias.`);

  console.log(
    `${resumen.filasPermitidas} filas pertenecen a los IDC activos del portafolio.`,
  );

  console.log(`Garantías guardadas: ${resumen.garantiasGuardadas}`);

  console.log(
    `Códigos repetidos entre distintos registros: ${resumen.codigosRepetidos}`,
  );
}

main().catch((error) => {
  console.error("Error importando garantías:", error);

  process.exitCode = 1;
});
