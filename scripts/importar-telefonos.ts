// scripts/importar-telefonos.ts

import fs from "fs";
import { importarTelefonosDesdeBuffer } from "../lib/importar-telefonos";

const rutaArchivo = process.argv[2];

if (!rutaArchivo) {
  console.error(
    "Falta la ruta del Excel. Uso: npx tsx scripts/importar-telefonos.ts <ruta>",
  );
  process.exit(1);
}

const buffer = fs.readFileSync(rutaArchivo);
const resumen = importarTelefonosDesdeBuffer(buffer);

if (!resumen.hojaEncontrada) {
  console.log('Este Excel no tiene hoja "Telefonos" — nada que importar.');
  process.exit(0);
}

console.log(`Leídas ${resumen.totalFilasLeidas} filas de la hoja Telefonos.`);
console.log(
  `${resumen.filasPermitidas} filas pertenecen a los funcionarios permitidos.`,
);
console.log(
  `--- Importación completa: ${resumen.telefonosGuardados} teléfonos guardados. ---`,
);
