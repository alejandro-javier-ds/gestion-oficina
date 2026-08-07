// lib/importar-telefonos.ts
// Lógica compartida para importar la hoja "Telefonos" de un
// portafolio.

import * as XLSX from "xlsx";
import db from "./db";
import { FUNCIONARIOS_PERMITIDOS, clasificarTelefono } from "./mapeo-columnas";

export type ResumenImportacionTelefonos = {
  hojaEncontrada: boolean;
  totalFilasLeidas: number;
  filasPermitidas: number;
  telefonosGuardados: number;
};

function limpiarTexto(texto: any): string {
  if (typeof texto !== "string") return "";
  return texto.replace(/[\s\u00A0]+/g, " ").trim();
}

function leerFecha(valor: any): string | null {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return valor.toISOString();
  }
  return String(valor);
}

export function importarTelefonosDesdeBuffer(
  buffer: Buffer,
): ResumenImportacionTelefonos {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hoja = workbook.Sheets["Telefonos"];

  if (!hoja) {
    return {
      hojaEncontrada: false,
      totalFilasLeidas: 0,
      filasPermitidas: 0,
      telefonosGuardados: 0,
    };
  }

  const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja);

  const filasFiltradas = filas.filter((fila) =>
    FUNCIONARIOS_PERMITIDOS.includes(limpiarTexto(fila["FUNCIONARIO"])),
  );

  db.prepare("DELETE FROM telefonos WHERE agregado_manualmente = 0").run();

  const insertar = db.prepare(`
    INSERT INTO telefonos (id_phone, idc, cic, phone, tipo_telefono, qtty_phone_ranking, creado_por, editado_por, fecha_modificacion, agregado_manualmente, activo)
    VALUES (@id_phone, @idc, @cic, @phone, @tipo_telefono, @qtty_phone_ranking, @creado_por, @editado_por, @fecha_modificacion, 0, 1)
    ON CONFLICT(id_phone) DO UPDATE SET
      idc = excluded.idc,
      cic = excluded.cic,
      phone = excluded.phone,
      tipo_telefono = excluded.tipo_telefono,
      qtty_phone_ranking = excluded.qtty_phone_ranking,
      creado_por = excluded.creado_por,
      editado_por = excluded.editado_por,
      fecha_modificacion = excluded.fecha_modificacion,
      activo = 1
  `);

  const transaccion = db.transaction((filas: Record<string, any>[]) => {
    let guardados = 0;
    for (const fila of filas) {
      const numero = String(fila["phone"] ?? "").trim();
      if (!numero) continue;

      insertar.run({
        id_phone: fila["id_phone"],
        idc: String(fila["customer_id"]),
        cic: fila["customer_cic"] != null ? String(fila["customer_cic"]) : null,
        phone: numero,
        tipo_telefono: clasificarTelefono(numero),
        qtty_phone_ranking: fila["qtty_phone_ranking"] ?? null,
        creado_por: fila["created_by"] ?? null,
        editado_por: fila["modified_by"] ?? null,
        fecha_modificacion: leerFecha(fila["dat_modified_at"]),
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
    telefonosGuardados: guardados,
  };
}
