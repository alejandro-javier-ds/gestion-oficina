// lib/importar-garantias.ts
// Importa la hoja "Garantias" del portafolio.
//
// PostgreSQL + ExcelJS.
//
// Las garantías permitidas se determinan a partir de
// los IDC activos existentes en cuentas.
//
// Relación:
//   Garantias.IDC -> cuentas.idc

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

export type ResumenImportacionGarantias = {
  hojaEncontrada: boolean;
  columnasAdaptadas: ColumnaAdaptada[];
  totalFilasLeidas: number;
  filasPermitidas: number;
  garantiasGuardadas: number;
  codigosRepetidos: number;
};

type FilaExcel = Record<string, unknown>;

type GarantiaPreparada = {
  garCodigo: string;
  idc: string;
  cliente: string | null;
  tipoGarantia: string | null;
  descripcion: string | null;
  moneda: string | null;
  montoComercial: number | null;
  montoAfectacion: number | null;
  montoRealizacion: number | null;
};

function limpiarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
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

export async function importarGarantiasDesdeBuffer(
  buffer: Buffer,
): Promise<ResumenImportacionGarantias> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const hoja = buscarHojaPortafolio(workbook, "Garantias");

  if (!hoja) {
    return {
      hojaEncontrada: false,
      columnasAdaptadas: [],
      totalFilasLeidas: 0,
      filasPermitidas: 0,
      garantiasGuardadas: 0,
      codigosRepetidos: 0,
    };
  }

  const lectura = leerHojaPortafolio(hoja, "Garantias");
  const { filas } = lectura;

  return conTransaccion(async (cliente) => {
    const anteriores = await cliente.query<FilaExcel>(
      "SELECT * FROM garantias",
    );
    const referencias = filasComoReferencias(anteriores.rows, "Garantias");
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
        "No existen IDC activos en cuentas. La importación de garantías fue cancelada.",
      );
    }

    const filasPermitidas = filas.filter((fila) =>
      idcsPermitidos.has(limpiarTexto(fila["IDC"])),
    );

    if (filas.length > 0 && filasPermitidas.length === 0) {
      throw new Error(
        "La hoja Garantias contiene datos, pero ninguno pertenece a los IDC activos del portafolio. No se realizó ningún cambio.",
      );
    }

    const garantiasPreparadas: GarantiaPreparada[] = [];

    const clavesVistas = new Set<string>();

    const codigosVistos = new Set<string>();

    let codigosRepetidos = 0;

    for (const fila of filasPermitidas) {
      const garCodigo = limpiarTexto(fila["GAR_CODIGO"]);

      const idc = limpiarTexto(fila["IDC"]);

      if (!garCodigo) {
        continue;
      }

      if (!idc) {
        throw new Error(
          `La garantía ${garCodigo} no tiene IDC. La importación fue cancelada.`,
        );
      }

      if (codigosVistos.has(garCodigo)) {
        codigosRepetidos++;
      }

      codigosVistos.add(garCodigo);

      const clave = `${garCodigo}\u0000${idc}`;

      if (clavesVistas.has(clave)) {
        throw new Error(
          `La garantía ${garCodigo} está repetida más de una vez para el IDC ${idc}. La importación fue cancelada.`,
        );
      }

      clavesVistas.add(clave);

      garantiasPreparadas.push({
        garCodigo,
        idc,

        cliente: limpiarTexto(fila["CLIENTE"]) || null,

        tipoGarantia: limpiarTexto(fila["TIPO_GARANTIA"]) || null,

        descripcion: limpiarTexto(fila["GAR_DESCRIPCION"]) || null,

        moneda: limpiarTexto(fila["GAR_MONEDA"]) || null,

        montoComercial: leerNumeroONull(fila["MTOCOMERCIALTASACION"]),

        montoAfectacion: leerNumeroONull(fila["MTOAFECTACION"]),

        montoRealizacion: leerNumeroONull(fila["MTOREALIZACIONTASACION"]),
      });
    }

    await cliente.query(
      `
          DELETE FROM garantias
        `,
    );

    const TAMANO_BLOQUE = 300;

    for (
      let inicio = 0;
      inicio < garantiasPreparadas.length;
      inicio += TAMANO_BLOQUE
    ) {
      const bloque = garantiasPreparadas.slice(inicio, inicio + TAMANO_BLOQUE);

      const valoresSql: string[] = [];

      const parametros: unknown[] = [];

      bloque.forEach((garantia, indice) => {
        const base = indice * 10;

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
                $${base + 10},
                1
              )`,
        );

        parametros.push(
          garantia.garCodigo,
          garantia.idc,
          garantia.cliente,
          garantia.tipoGarantia,
          garantia.descripcion,
          garantia.moneda,
          garantia.montoComercial,
          garantia.montoAfectacion,
          garantia.montoRealizacion,
          null,
        );
      });

      await cliente.query(
        `
            INSERT INTO garantias (
              gar_codigo,
              idc,
              cliente,
              tipo_garantia,
              descripcion,
              moneda,
              monto_comercial,
              monto_afectacion,
              monto_realizacion,
              funcionario,
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

      garantiasGuardadas: garantiasPreparadas.length,

      codigosRepetidos,
    };
  });
}
