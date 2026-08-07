// scripts/importar-garantias.ts

import fs from "fs";
import { importarGarantiasDesdeBuffer } from "../lib/importar-garantias";

const rutaArchivo = process.argv[2];

if (!rutaArchivo) {
  console.error(
    "Falta la ruta del Excel. Uso: npx tsx scripts/importar-garantias.ts <ruta>",
  );
  process.exit(1);
}

const buffer = fs.readFileSync(rutaArchivo);
const resumen = importarGarantiasDesdeBuffer(buffer);

if (!resumen.hojaEncontrada) {
  console.log('Este Excel no tiene hoja "Garantias" — nada que importar.');
  process.exit(0);
}

console.log(`Leídas ${resumen.totalFilasLeidas} filas de la hoja Garantias.`);
console.log(
  `${resumen.filasPermitidas} filas pertenecen a los funcionarios permitidos.`,
);
if (resumen.codigosRepetidos > 0) {
  console.log(
    `Aviso: ${resumen.codigosRepetidos} filas tenían un GAR_CODIGO repetido — se quedó la última versión de cada una.`,
  );
}
console.log(
  `--- Importación completa: ${resumen.garantiasGuardadas} garantías guardadas. ---`,
);
