// scripts/importar-portafolio.ts
// Lee un Excel de portafolio desde disco y lo sincroniza con la
// tabla `cuentas`

import fs from "fs";
import path from "path";
import { importarPortafolioDesdeBuffer } from "../lib/importar-cuentas";

const rutaArchivo = process.argv[2];

if (!rutaArchivo) {
  console.error(
    "Falta la ruta del Excel. Uso: npx tsx scripts/importar-portafolio.ts <ruta>",
  );
  process.exit(1);
}

const nombreArchivo = path.basename(rutaArchivo);
const buffer = fs.readFileSync(rutaArchivo);

const resumen = importarPortafolioDesdeBuffer(buffer, nombreArchivo);

console.log(`Leídas ${resumen.totalFilasLeidas} filas del Excel.`);
console.log(
  `${resumen.filasPermitidas} filas pertenecen a los funcionarios permitidos.`,
);
console.log("--- Resumen del import ---");
console.log("Cuentas nuevas:", resumen.cuentasNuevas);
console.log("Cuentas actualizadas:", resumen.cuentasActualizadas);
console.log("Cuentas dadas de baja:", resumen.cuentasDadasDeBaja);
