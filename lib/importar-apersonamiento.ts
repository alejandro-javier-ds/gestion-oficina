// lib/importar-apersonamiento.ts
// Lógica compartida para importar la hoja "Apersonamiento" de un
// portafolio.

import * as XLSX from "xlsx";
import db from "./db";

export type ResumenImportacionApersonamiento = {
  hojaEncontrada: boolean;
  totalFilasLeidas: number;
  filasPermitidas: number;
  registrosGuardados: number;
};

function limpiarTexto(texto: any): string {
  if (typeof texto !== "string") return "";
  return texto.replace(/[\s\u00A0]+/g, " ").trim();
}

export function importarApersonamientoDesdeBuffer(
  buffer: Buffer,
): ResumenImportacionApersonamiento {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const hoja = workbook.Sheets["Apersonamiento"];

  if (!hoja) {
    return {
      hojaEncontrada: false,
      totalFilasLeidas: 0,
      filasPermitidas: 0,
      registrosGuardados: 0,
    };
  }

  const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja);

  const idcsPermitidos = new Set(
    db
      .prepare("SELECT DISTINCT idc FROM cuentas")
      .all()
      .map((r: any) => String(r.idc)),
  );

  const filasFiltradas = filas.filter((fila) =>
    idcsPermitidos.has(String(fila["IDC"])),
  );

  db.prepare("DELETE FROM apersonamiento").run();

  const insertar = db.prepare(`
    INSERT INTO apersonamiento (
      idc, codcuentacobranza, cliente, desgrupofuncional,
      fec_asignacion_lgm, fecha_entrega, motivo, montodeudatotal, activo
    ) VALUES (
      @idc, @codcuentacobranza, @cliente, @desgrupofuncional,
      @fec_asignacion_lgm, @fecha_entrega, @motivo, @montodeudatotal, 1
    )
  `);

  const transaccion = db.transaction((filas: Record<string, any>[]) => {
    let guardados = 0;
    for (const fila of filas) {
      insertar.run({
        idc: String(fila["IDC"]),
        codcuentacobranza:
          fila["CODCUENTACOBRANZA"] != null
            ? String(fila["CODCUENTACOBRANZA"])
            : null,
        cliente: limpiarTexto(fila["CLIENTE"]) || null,
        desgrupofuncional: fila["DESGRUPOFUNCIONAL"] ?? null,
        fec_asignacion_lgm: fila["FEC_ASIGNACION_LGM"] ?? null,
        fecha_entrega: fila["FECHA_ENTREGA"] ?? null,
        motivo: fila["MOTIVO"] ?? null,
        montodeudatotal: fila["MONTODEUDATOTAL"] ?? null,
      });
      guardados++;
    }
    return guardados;
  });

  const guardados = transaccion(filasFiltradas);

  return {
    hojaEncontrada: true,
    totalFilasLeidas: filas.length,
    filasPermitidas: filasFiltradas.length,
    registrosGuardados: guardados,
  };
}
