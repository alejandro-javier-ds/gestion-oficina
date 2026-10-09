// lib/importar-telefonos.ts
// Importa la hoja "Telefonos" del portafolio.
//
// PostgreSQL + ExcelJS.
//
// Regla:
// - agregado_manualmente = 0 → teléfono de portafolio.
//   Se reemplaza en cada nueva importación.
// - agregado_manualmente = 1 → teléfono agregado por un usuario.
//   Nunca se elimina al importar un portafolio.
//
// Los teléfonos permitidos se determinan mediante:
//
//   Telefonos.customer_id -> cuentas.idc activas

import ExcelJS from "exceljs";

import { conTransaccion } from "./postgres";
import {
  buscarHojaPortafolio,
  ColumnaAdaptada,
  completarCamposAusentes,
  filasComoReferencias,
  leerHojaPortafolio,
  reconocerColumnasPorContenido,
  validarColumnasPortafolio,
} from "./portafolio-excel";
import { clasificarTelefono } from "./mapeo-columnas";

export type ResumenImportacionTelefonos = {
  hojaEncontrada: boolean;
  columnasAdaptadas: ColumnaAdaptada[];
  totalFilasLeidas: number;
  filasPermitidas: number;
  telefonosGuardados: number;
};

type FilaExcel = Record<string, unknown>;

type TelefonoPreparado = {
  idPhone: number;
  idc: string;
  cic: string | null;
  phone: string;
  tipoTelefono: "celular" | "fijo" | "revisar";
  ranking: number | null;
  creadoPor: string | null;
  editadoPor: string | null;
  fechaModificacion: string | null;
};

function limpiarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
}

function leerFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return null;
    }

    return valor.toISOString();
  }

  return String(valor);
}

function leerNumeroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero =
    typeof valor === "number"
      ? valor
      : Number(String(valor).trim().replace(",", "."));

  return Number.isFinite(numero) ? numero : null;
}

function leerIdPhone(valor: unknown): number {
  const numero =
    typeof valor === "number" ? valor : Number(limpiarTexto(valor));

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(
      `Se encontró un id_phone inválido en la hoja Telefonos: "${limpiarTexto(
        valor,
      )}".`,
    );
  }

  return numero;
}

export async function importarTelefonosDesdeBuffer(
  buffer: Buffer,
): Promise<ResumenImportacionTelefonos> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const hoja = buscarHojaPortafolio(workbook, "Telefonos");

  if (!hoja) {
    return {
      hojaEncontrada: false,
      columnasAdaptadas: [],
      totalFilasLeidas: 0,
      filasPermitidas: 0,
      telefonosGuardados: 0,
    };
  }

  const lectura = leerHojaPortafolio(hoja, "Telefonos");
  const { filas } = lectura;

  return conTransaccion(async (cliente) => {
    const anteriores = await cliente.query<FilaExcel>(
      "SELECT * FROM telefonos WHERE agregado_manualmente = 0",
    );
    const referencias = filasComoReferencias(anteriores.rows, "Telefonos");
    reconocerColumnasPorContenido(lectura, referencias);
    validarColumnasPortafolio(lectura);
    completarCamposAusentes(lectura, referencias);

    const resultadoIdcs = await cliente.query<{
      idc: string;
    }>(
      `
            SELECT DISTINCT idc
            FROM cuentas
            WHERE activo = 1
          `,
    );

    const idcsPermitidos = new Set(
      resultadoIdcs.rows.map((fila) => String(fila.idc)),
    );

    if (idcsPermitidos.size === 0) {
      throw new Error(
        "No existen IDC activos en cuentas. La importación de teléfonos fue cancelada.",
      );
    }

    const filasPermitidas = filas.filter((fila) =>
      idcsPermitidos.has(limpiarTexto(fila["customer_id"])),
    );

    if (filas.length > 0 && filasPermitidas.length === 0) {
      throw new Error(
        "La hoja Telefonos contiene datos, pero ninguno pertenece a los IDC activos del portafolio. No se realizó ningún cambio.",
      );
    }

    const telefonosPreparados: TelefonoPreparado[] = [];

    const idsVistos = new Set<number>();

    for (const fila of filasPermitidas) {
      const numero = limpiarTexto(fila["phone"]);

      if (!numero) {
        continue;
      }

      const idPhone = leerIdPhone(fila["id_phone"]);

      if (idsVistos.has(idPhone)) {
        throw new Error(
          `El portafolio contiene el id_phone ${idPhone} más de una vez. La importación fue cancelada.`,
        );
      }

      idsVistos.add(idPhone);

      const idc = limpiarTexto(fila["customer_id"]);

      telefonosPreparados.push({
        idPhone,
        idc,

        cic: limpiarTexto(fila["customer_cic"]) || null,

        phone: numero,

        tipoTelefono: clasificarTelefono(numero),

        ranking: leerNumeroONull(fila["qtty_phone_ranking"]),

        creadoPor: limpiarTexto(fila["created_by"]) || null,

        editadoPor: limpiarTexto(fila["modified_by"]) || null,

        fechaModificacion: leerFecha(fila["dat_modified_at"]),
      });
    }

    await cliente.query(
      `
          DELETE FROM telefonos
          WHERE agregado_manualmente = 0
        `,
    );

    const TAMANO_BLOQUE = 500;

    for (
      let inicio = 0;
      inicio < telefonosPreparados.length;
      inicio += TAMANO_BLOQUE
    ) {
      const bloque = telefonosPreparados.slice(inicio, inicio + TAMANO_BLOQUE);

      const valoresSql: string[] = [];
      const parametros: unknown[] = [];

      bloque.forEach((telefono, indice) => {
        const base = indice * 9;

        valoresSql.push(
          `(
                $${base + 1},
                $${base + 2},
                $${base + 3},
                $${base + 4},
                $${base + 5},
                $${base + 6},
                $${base + 7},
                $${base + 8},
                $${base + 9},
                0,
                1
              )`,
        );

        parametros.push(
          telefono.idPhone,
          telefono.idc,
          telefono.cic,
          telefono.phone,
          telefono.tipoTelefono,
          telefono.ranking,
          telefono.creadoPor,
          telefono.editadoPor,
          telefono.fechaModificacion,
        );
      });

      await cliente.query(
        `
            INSERT INTO telefonos (
              id_phone,
              idc,
              cic,
              phone,
              tipo_telefono,
              qtty_phone_ranking,
              creado_por,
              editado_por,
              fecha_modificacion,
              agregado_manualmente,
              activo
            )
            VALUES
              ${valoresSql.join(",")}
          `,
        parametros,
      );
    }

    return {
      hojaEncontrada: true,
      columnasAdaptadas: lectura.columnasAdaptadas,
      totalFilasLeidas: filas.length,
      filasPermitidas: filasPermitidas.length,
      telefonosGuardados: telefonosPreparados.length,
    };
  });
}
