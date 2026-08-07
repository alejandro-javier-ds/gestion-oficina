// scripts/importar-apersonamiento.ts

import fs from "fs";
import { importarApersonamientoDesdeBuffer } from "../lib/importar-apersonamiento";

const rutaArchivo = process.argv[2];

if (!rutaArchivo) {
  console.error(
    "Falta la ruta del Excel. Uso: npx tsx scripts/importar-apersonamiento.ts <ruta>",
  );
  process.exit(1);
}

const buffer = fs.readFileSync(rutaArchivo);
const resumen = importarApersonamientoDesdeBuffer(buffer);

if (!resumen.hojaEncontrada) {
  console.log('Este Excel no tiene hoja "Apersonamiento" — nada que importar.');
  process.exit(0);
}

console.log(
  `Leídas ${resumen.totalFilasLeidas} filas de la hoja Apersonamiento.`,
);
console.log(
  `${resumen.filasPermitidas} filas pertenecen a clientes de la cartera permitida.`,
);
console.log(
  `--- Importación completa: ${resumen.registrosGuardados} registros de apersonamiento guardados. ---`,
);
