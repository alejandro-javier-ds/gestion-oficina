// lib/importar-garantias.ts
// Lógica compartida para importar la hoja "Garantias" de un
// portafolio.

import * as XLSX from "xlsx";
import db from "./db";
import { FUNCIONARIOS_PERMITIDOS } from "./mapeo-columnas";

export type ResumenImportacionGarantias = {
  hojaEncontrada: boolean;
  totalFilasLeidas: number;
  filasPermitidas: number;
  garantiasGuardadas: number;
  codigosRepetidos: number;
};

function limpiarTexto(texto: any): string {
  if (typeof texto !== "string") return "";
  return texto.replace(/[\s\u00A0]+/g, " ").trim();
}

export function importarGarantiasDesdeBuffer(
  buffer: Buffer,
): ResumenImportacionGarantias {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const hoja = workbook.Sheets["Garantias"];

  if (!hoja) {
    return {
      hojaEncontrada: false,
      totalFilasLeidas: 0,
      filasPermitidas: 0,
      garantiasGuardadas: 0,
      codigosRepetidos: 0,
    };
  }

  const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja);

  const filasFiltradas = filas.filter((fila) =>
    FUNCIONARIOS_PERMITIDOS.includes(limpiarTexto(fila["FUNCIONARIO"])),
  );

  const codigosVistos = new Set<string>();
  let repetidos = 0;
  for (const fila of filasFiltradas) {
    const codigo = String(fila["GAR_CODIGO"] ?? "").trim();
    if (codigo && codigosVistos.has(codigo)) repetidos++;
    codigosVistos.add(codigo);
  }

  db.prepare("DELETE FROM garantias").run();

  const insertar = db.prepare(`
    INSERT OR REPLACE INTO garantias (
      gar_codigo, idc, cliente, tipo_garantia, descripcion, moneda,
      monto_comercial, monto_afectacion, monto_realizacion, funcionario, activo
    ) VALUES (
      @gar_codigo, @idc, @cliente, @tipo_garantia, @descripcion, @moneda,
      @monto_comercial, @monto_afectacion, @monto_realizacion, @funcionario, 1
    )
  `);

  const transaccion = db.transaction((filas: Record<string, any>[]) => {
    let guardadas = 0;
    for (const fila of filas) {
      const codigo = String(fila["GAR_CODIGO"] ?? "").trim();
      if (!codigo) continue;

      insertar.run({
        gar_codigo: codigo,
        idc: String(fila["IDC"]),
        cliente: limpiarTexto(fila["CLIENTE"]) || null,
        tipo_garantia: fila["TIPO_GARANTIA"] ?? null,
        descripcion: fila["GAR_DESCRIPCION"] ?? null,
        moneda: fila["GAR_MONEDA"] ?? null,
        monto_comercial: fila["MTOCOMERCIALTASACION"] ?? null,
        monto_afectacion: fila["MTOAFECTACION"] ?? null,
        monto_realizacion: fila["MTOREALIZACIONTASACION"] ?? null,
        funcionario: limpiarTexto(fila["FUNCIONARIO"]) || null,
      });
      guardadas++;
    }
    return guardadas;
  });

  const guardadas = transaccion(filasFiltradas);

  return {
    hojaEncontrada: true,
    totalFilasLeidas: filas.length,
    filasPermitidas: filasFiltradas.length,
    garantiasGuardadas: guardadas,
    codigosRepetidos: repetidos,
  };
}
