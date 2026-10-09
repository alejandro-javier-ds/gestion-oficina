// lib/importar-apersonamiento.ts
// Importa la hoja "Apersonamiento" del portafolio.
//
// PostgreSQL + ExcelJS.
//
// Los registros permitidos se determinan mediante:
//
//   Apersonamiento.IDC -> cuentas.idc activas

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

export type ResumenImportacionApersonamiento = {
  hojaEncontrada: boolean;
  columnasAdaptadas: ColumnaAdaptada[];
  totalFilasLeidas: number;
  filasPermitidas: number;
  registrosGuardados: number;
};

type FilaExcel = Record<string, unknown>;

type ApersonamientoPreparado = {
  idc: string;
  codcuentacobranza: string | null;
  cliente: string | null;
  desgrupofuncional: string | null;
  fecAsignacionLgm: string | null;
  fechaEntrega: string | null;
  motivo: string | null;
  montoDeudaTotal: number | null;
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

    return valor.toISOString().slice(0, 10);
  }

  return limpiarTexto(valor) || null;
}

function leerNumeroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const texto = limpiarTexto(valor);

  if (!texto) {
    return null;
  }

  const numero = Number(texto.replace(",", "."));

  return Number.isFinite(numero) ? numero : null;
}

export async function importarApersonamientoDesdeBuffer(
  buffer: Buffer,
): Promise<ResumenImportacionApersonamiento> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const hoja = buscarHojaPortafolio(workbook, "Apersonamiento");

  if (!hoja) {
    return {
      hojaEncontrada: false,
      columnasAdaptadas: [],
      totalFilasLeidas: 0,
      filasPermitidas: 0,
      registrosGuardados: 0,
    };
  }

  const lectura = leerHojaPortafolio(hoja, "Apersonamiento");
  const { filas } = lectura;

  return conTransaccion(async (cliente) => {
    const anteriores = await cliente.query<FilaExcel>(
      "SELECT * FROM apersonamiento",
    );
    const referencias = filasComoReferencias(anteriores.rows, "Apersonamiento");
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
        "No existen IDC activos en cuentas. La importación de apersonamiento fue cancelada.",
      );
    }

    const filasPermitidas = filas.filter((fila) =>
      idcsPermitidos.has(limpiarTexto(fila["IDC"])),
    );

    if (filas.length > 0 && filasPermitidas.length === 0) {
      throw new Error(
        "La hoja Apersonamiento contiene datos, pero ninguno pertenece a los IDC activos del portafolio. No se realizó ningún cambio.",
      );
    }

    const registros: ApersonamientoPreparado[] = [];

    for (const fila of filasPermitidas) {
      const idc = limpiarTexto(fila["IDC"]);

      if (!idc) {
        throw new Error(
          "Se encontró un registro de apersonamiento sin IDC. La importación fue cancelada.",
        );
      }

      registros.push({
        idc,

        codcuentacobranza: limpiarTexto(fila["CODCUENTACOBRANZA"]) || null,

        cliente: limpiarTexto(fila["CLIENTE"]) || null,

        desgrupofuncional: limpiarTexto(fila["DESGRUPOFUNCIONAL"]) || null,

        fecAsignacionLgm: leerFecha(fila["FEC_ASIGNACION_LGM"]),

        fechaEntrega: leerFecha(fila["FECHA_ENTREGA"]),

        motivo: limpiarTexto(fila["MOTIVO"]) || null,

        montoDeudaTotal: leerNumeroONull(fila["MONTODEUDATOTAL"]),
      });
    }

    await cliente.query(
      `
          DELETE FROM apersonamiento
        `,
    );

    const TAMANO_BLOQUE = 300;

    for (let inicio = 0; inicio < registros.length; inicio += TAMANO_BLOQUE) {
      const bloque = registros.slice(inicio, inicio + TAMANO_BLOQUE);

      const valoresSql: string[] = [];

      const parametros: unknown[] = [];

      bloque.forEach((registro, indice) => {
        const base = indice * 8;

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
                1
              )`,
        );

        parametros.push(
          registro.idc,
          registro.codcuentacobranza,
          registro.cliente,
          registro.desgrupofuncional,
          registro.fecAsignacionLgm,
          registro.fechaEntrega,
          registro.motivo,
          registro.montoDeudaTotal,
        );
      });

      await cliente.query(
        `
            INSERT INTO apersonamiento (
              idc,
              codcuentacobranza,
              cliente,
              desgrupofuncional,
              fec_asignacion_lgm,
              fecha_entrega,
              motivo,
              montodeudatotal,
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

      registrosGuardados: registros.length,
    };
  });
}
