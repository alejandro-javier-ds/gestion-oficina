import ExcelJS from "exceljs";

import {
  MAPEO_APERSONAMIENTO,
  MAPEO_CUENTAS,
  MAPEO_GARANTIAS,
  MAPEO_TELEFONOS,
} from "./mapeo-columnas";

export type FilaPortafolio = Record<string, unknown>;
export type TipoHojaPortafolio =
  | "Cuentas"
  | "Telefonos"
  | "Garantias"
  | "Apersonamiento";

export type ColumnaAdaptada = {
  original: string;
  campo: string;
  metodo: "encabezado" | "contenido";
};

export class ErrorFormatoPortafolio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorFormatoPortafolio";
  }
}

const ALIASES_COMUNES: Record<string, string[]> = {
  CODCUENTACOBRANZA: [
    "CODIGO CUENTA",
    "COD CUENTA",
    "NUMERO CUENTA",
    "NRO CUENTA",
    "CUENTA",
    "CODIGO CUENTA COBRANZA",
  ],
  IDC: ["ID CLIENTE", "CODIGO CLIENTE", "COD CLIENTE", "CUSTOMER ID"],
  CLIENTE: [
    "NOMBRE CLIENTE",
    "NOMBRE COMPLETO CLIENTE",
    "NOMBRE DEL CLIENTE",
    "TITULAR",
    "DEUDOR",
  ],
  FUNCIONARIO: [
    "ASESOR",
    "ASESOR JUDICIAL",
    "FUNCIONARIO JUDICIAL",
    "EJECUTIVO",
    "EJECUTIVO COBRANZA",
    "RESPONSABLE",
  ],
  GESTOR: [
    "ASESOR",
    "RESPONSABLE",
    "GESTOR ASIGNADO",
    "GESTOR COBRANZA",
    "GESTOR CARTERA",
    "NOMBRE GESTOR",
    "COBRADOR",
  ],
  MTODEUDA_SOL: ["DEUDA TOTAL SOL", "DEUDA TOTAL SOLES", "MONTO DEUDA SOLES"],
  MTODEUDAVENCIDA_SOL: [
    "DEUDA VENCIDA SOL",
    "DEUDA VENCIDA SOLES",
    "MONTO DEUDA VENCIDA SOLES",
  ],
  CODMONEDA: ["MONEDA", "CODIGO MONEDA"],
  DEUDATOTAL_MONEDAORIGEN: [
    "DEUDA TOTAL MONEDA ORIGEN",
    "DEUDA TOTAL ORIGINAL",
  ],
  DEUDAVENCIDA_MONEDAORIGEN: [
    "DEUDA VENCIDA MONEDA ORIGEN",
    "DEUDA VENCIDA ORIGINAL",
  ],
  DIASMORA: ["DIAS DE MORA"],
  DESCPRODUCTO: ["PRODUCTO", "NOMBRE PRODUCTO", "DESCRIPCION PRODUCTO"],
  CLASIF_RIESGOBCP: ["NIVEL RIESGO", "CLASIFICACION RIESGO"],
  NRO_JUICIO: ["NUMERO JUICIO", "NUMERO DE JUICIO", "NRO DE JUICIO"],
  FEC_DEMANDA: ["FECHA DEMANDA"],
  FEC_ENTREGA_LEGAJO_A_ESTUDIO: ["FECHA ENTREGA LEGAJO A ESTUDIO"],
  "SUPERVISOR PROCESAL": ["NOMBRE SUPERVISOR PROCESAL"],
  "ANALISTA PROCESAL": ["NOMBRE ANALISTA PROCESAL"],
  GAR_CODIGO: ["CODIGO GARANTIA", "ID GARANTIA"],
  GAR_DESCRIPCION: ["DESCRIPCION GARANTIA", "DESCRIPCION"],
  GAR_MONEDA: ["MONEDA GARANTIA", "MONEDA"],
  MTOCOMERCIALTASACION: ["MONTO COMERCIAL", "MONTO COMERCIAL TASACION"],
  MTOAFECTACION: ["MONTO AFECTACION"],
  MTOREALIZACIONTASACION: ["MONTO REALIZACION", "MONTO REALIZACION TASACION"],
  FEC_ASIGNACION_LGM: ["FECHA ASIGNACION LGM"],
  MONTODEUDATOTAL: ["MONTO DEUDA TOTAL", "DEUDA TOTAL"],
};

const CONFIGURACIONES = {
  Cuentas: {
    mapeo: MAPEO_CUENTAS,
    requeridas: ["CODCUENTACOBRANZA", "IDC", "CLIENTE", "FUNCIONARIO"],
    claves: ["CODCUENTACOBRANZA"],
    aliases: ALIASES_COMUNES,
  },
  Telefonos: {
    mapeo: MAPEO_TELEFONOS,
    requeridas: ["id_phone", "customer_id", "phone"],
    claves: ["id_phone"],
    aliases: {
      id_phone: ["ID TELEFONO", "CODIGO TELEFONO"],
      customer_id: ["IDC", "ID CLIENTE", "CODIGO CLIENTE"],
      customer_cic: ["CIC", "CIC CLIENTE"],
      phone: ["TELEFONO", "NUMERO TELEFONO", "NUMERO DE TELEFONO", "CELULAR"],
      qtty_phone_ranking: ["RANKING", "RANKING TELEFONO"],
      created_by: ["CREADO POR"],
      modified_by: ["MODIFICADO POR", "EDITADO POR"],
      dat_modified_at: ["FECHA MODIFICACION", "FECHA ULTIMA MODIFICACION"],
    } as Record<string, string[]>,
  },
  Garantias: {
    mapeo: MAPEO_GARANTIAS,
    requeridas: ["GAR_CODIGO", "IDC"],
    claves: ["GAR_CODIGO", "IDC"],
    aliases: ALIASES_COMUNES,
  },
  Apersonamiento: {
    mapeo: MAPEO_APERSONAMIENTO,
    requeridas: ["IDC"],
    claves: ["IDC", "CODCUENTACOBRANZA"],
    aliases: ALIASES_COMUNES,
  },
};

export function normalizarTextoPortafolio(valor: unknown): string {
  if (valor == null) return "";
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? ""
      : valor.toISOString().slice(0, 10);
  }
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarEncabezado(valor: unknown): string {
  return normalizarTextoPortafolio(valor).replace(/[^A-Z0-9]/g, "");
}

function valorCelda(celda: ExcelJS.Cell): unknown {
  const valor = celda.value;
  if (valor == null || valor instanceof Date || typeof valor !== "object") {
    return valor ?? null;
  }
  if ("result" in valor) return valor.result ?? null;
  if ("text" in valor) return valor.text;
  if ("richText" in valor)
    return valor.richText.map((parte) => parte.text).join("");
  return celda.text;
}

export function buscarHojaPortafolio(
  workbook: ExcelJS.Workbook,
  nombre: TipoHojaPortafolio,
): ExcelJS.Worksheet | undefined {
  const candidatas = workbook.worksheets.filter(
    (hoja) => normalizarEncabezado(hoja.name) === normalizarEncabezado(nombre),
  );
  if (candidatas.length > 1) {
    throw new ErrorFormatoPortafolio(
      'Hay varias hojas equivalentes a "' +
      nombre +
      '". Identifica una sola antes de importar.',
    );
  }
  return candidatas[0];
}

export type LecturaPortafolio = {
  tipo: TipoHojaPortafolio;
  filas: FilaPortafolio[];
  encabezados: Set<string>;
  columnasAdaptadas: ColumnaAdaptada[];
  desconocidas: Set<string>;
  aliasesPendientes: Map<string, string[]>;
};

export function leerHojaPortafolio(
  hoja: ExcelJS.Worksheet,
  tipo: TipoHojaPortafolio,
): LecturaPortafolio {
  const config = CONFIGURACIONES[tipo];
  const porNombre = new Map<string, string>();
  const porAlias = new Map<string, Set<string>>();
  for (const [campo, columnaDb] of Object.entries(config.mapeo)) {
    for (const nombre of [campo, columnaDb])
      porNombre.set(normalizarEncabezado(nombre), campo);
    for (const nombre of config.aliases[campo] ?? []) {
      const normalizado = normalizarEncabezado(nombre);
      const campos = porAlias.get(normalizado) ?? new Set<string>();
      campos.add(campo);
      porAlias.set(normalizado, campos);
    }
  }

  const porColumna = new Map<number, string>();
  const encabezados = new Set<string>();
  const originales = new Set<string>();
  const desconocidas = new Set<string>();
  const aliasesPendientes = new Map<string, string[]>();
  const columnasAdaptadas: ColumnaAdaptada[] = [];
  hoja.getRow(1).eachCell((celda, numero) => {
    const original = celda.text.replace(/[\s\u00a0]+/g, " ").trim();
    if (!original) return;
    const normalizado = normalizarEncabezado(original);
    const aliases = [...(porAlias.get(normalizado) ?? [])];
    const campoReconocido =
      porNombre.get(normalizado) ??
      (aliases.length === 1 ? aliases[0] : undefined);
    const campo = campoReconocido ?? original;
    if (!campoReconocido && aliases.length > 1)
      aliasesPendientes.set(original, aliases);
    if (originales.has(normalizado) || encabezados.has(campo)) {
      throw new ErrorFormatoPortafolio(
        'La hoja "' +
        tipo +
        '" tiene varias columnas equivalentes a "' +
        campo +
        '". No se puede elegir una automáticamente.',
      );
    }
    originales.add(normalizado);
    encabezados.add(campo);
    porColumna.set(numero, campo);
    if (!campoReconocido) desconocidas.add(original);
    else if (original !== campo)
      columnasAdaptadas.push({ original, campo, metodo: "encabezado" });
  });

  const filas: FilaPortafolio[] = [];
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return;
    const valores = [...porColumna].map(
      ([columna, campo]) => [campo, valorCelda(fila.getCell(columna))] as const,
    );
    if (valores.some(([, valor]) => normalizarTextoPortafolio(valor) !== "")) {
      filas.push(Object.fromEntries(valores));
    }
  });
  const lectura = {
    tipo,
    filas,
    encabezados,
    columnasAdaptadas,
    desconocidas,
    aliasesPendientes,
  };
  resolverAliasesPendientes(lectura);
  return lectura;
}

function claveFila(fila: FilaPortafolio, campos: string[]): string | null {
  const valores = campos.map((campo) => normalizarTextoPortafolio(fila[campo]));
  return valores.every(Boolean) ? JSON.stringify(valores) : null;
}

function indexarReferencias(referencias: FilaPortafolio[], claves: string[]) {
  const indice = new Map<string, FilaPortafolio[]>();
  for (const fila of referencias) {
    const clave = claveFila(fila, claves);
    if (clave) indice.set(clave, [...(indice.get(clave) ?? []), fila]);
  }
  return indice;
}

function aplicarCorrespondencias(
  lectura: LecturaPortafolio,
  candidatos: Array<{ original: string; campo: string }>,
  metodo: ColumnaAdaptada["metodo"] = "contenido",
): void {
  for (const candidato of candidatos) {
    const conflictos = candidatos.filter(
      (otro) =>
        otro.original === candidato.original || otro.campo === candidato.campo,
    );
    if (conflictos.length > 1) {
      throw new ErrorFormatoPortafolio(
        'El contenido de "' +
        candidato.original +
        '" en "' +
        lectura.tipo +
        '" permite varias correspondencias. Usa un encabezado inequívoco antes de importar.',
      );
    }
  }
  for (const { original, campo } of candidatos) {
    for (const fila of lectura.filas) {
      fila[campo] = fila[original];
      delete fila[original];
    }
    lectura.encabezados.delete(original);
    lectura.encabezados.add(campo);
    lectura.desconocidas.delete(original);
    lectura.aliasesPendientes.delete(original);
    lectura.columnasAdaptadas.push({ original, campo, metodo });
  }
}

function resolverAliasesPendientes(lectura: LecturaPortafolio): void {
  let cambiaron = true;
  while (cambiaron) {
    cambiaron = false;
    const candidatos: Array<{ original: string; campo: string }> = [];
    for (const [original, campos] of lectura.aliasesPendientes) {
      const disponibles = campos.filter(
        (campo) => !lectura.encabezados.has(campo),
      );
      if (disponibles.length === 1)
        candidatos.push({ original, campo: disponibles[0] });
      else if (!disponibles.length) {
        throw new ErrorFormatoPortafolio(
          'El encabezado "' +
          original +
          '" en "' +
          lectura.tipo +
          '" coincide con varias columnas ya presentes. Identifica su función antes de importar.',
        );
      }
    }
    if (candidatos.length) {
      aplicarCorrespondencias(lectura, candidatos, "encabezado");
      cambiaron = true;
    }
  }
}

export function reconocerColumnasPorContenido(
  lectura: LecturaPortafolio,
  referencias: FilaPortafolio[],
): void {
  const config = CONFIGURACIONES[lectura.tipo];
  if (!referencias.length || !lectura.desconocidas.size) return;

  const candidatosClave: Array<{ original: string; campo: string }> = [];
  for (const campo of config.claves.filter(
    (campo) => !lectura.encabezados.has(campo),
  )) {
    const conocidos = new Set(
      referencias
        .map((fila) => normalizarTextoPortafolio(fila[campo]))
        .filter(Boolean),
    );
    for (const original of lectura.desconocidas) {
      const valores = lectura.filas
        .map((fila) => normalizarTextoPortafolio(fila[original]))
        .filter(Boolean);
      const coincidencias = valores.filter((valor) => conocidos.has(valor));
      if (
        new Set(coincidencias).size >= 3 &&
        coincidencias.length / valores.length >= 0.5
      ) {
        candidatosClave.push({ original, campo });
      }
    }
  }
  aplicarCorrespondencias(lectura, candidatosClave);

  const indice = indexarReferencias(referencias, config.claves);
  const candidatos: Array<{ original: string; campo: string }> = [];
  for (const campo of Object.keys(config.mapeo).filter(
    (campo) => !lectura.encabezados.has(campo),
  )) {
    for (const original of lectura.desconocidas) {
      let comparables = 0;
      let coincidencias = 0;
      const clavesCoincidentes = new Set<string>();
      for (const fila of lectura.filas) {
        const clave = claveFila(fila, config.claves);
        const anteriores = clave ? indice.get(clave) : undefined;
        const valor = normalizarTextoPortafolio(fila[original]);
        if (!anteriores || !valor) continue;
        const conocidos = anteriores
          .map((anterior) => normalizarTextoPortafolio(anterior[campo]))
          .filter(Boolean);
        if (!conocidos.length) continue;
        comparables++;
        if (conocidos.includes(valor)) {
          coincidencias++;
          clavesCoincidentes.add(clave!);
        }
      }
      if (clavesCoincidentes.size >= 3 && coincidencias / comparables >= 0.9) {
        candidatos.push({ original, campo });
      }
    }
  }
  aplicarCorrespondencias(lectura, candidatos);
  resolverAliasesPendientes(lectura);
}

export function validarColumnasPortafolio(lectura: LecturaPortafolio): void {
  if (lectura.aliasesPendientes.size) {
    throw new ErrorFormatoPortafolio(
      'Hay encabezados ambiguos en "' +
      lectura.tipo +
      '": ' +
      [...lectura.aliasesPendientes.keys()].join(", ") +
      ". Identifica sus columnas antes de importar.",
    );
  }
  const faltantes = CONFIGURACIONES[lectura.tipo].requeridas.filter(
    (campo) => !lectura.encabezados.has(campo),
  );
  if (faltantes.length) {
    throw new ErrorFormatoPortafolio(
      "No se pudieron reconocer las columnas " +
      faltantes.join(", ") +
      ' de la hoja "' +
      lectura.tipo +
      '". Revisa sus encabezados; no se guardaron cambios.',
    );
  }
}

export function filasComoReferencias(
  filasDb: FilaPortafolio[],
  tipo: TipoHojaPortafolio,
): FilaPortafolio[] {
  return filasDb.map((fila) =>
    Object.fromEntries(
      Object.entries(CONFIGURACIONES[tipo].mapeo).map(([campo, columna]) => [
        campo,
        fila[columna],
      ]),
    ),
  );
}

export function completarCamposAusentes(
  lectura: LecturaPortafolio,
  referencias: FilaPortafolio[],
): void {
  const config = CONFIGURACIONES[lectura.tipo];
  const indice = indexarReferencias(referencias, config.claves);
  const ausentes = Object.keys(config.mapeo).filter(
    (campo) => !lectura.encabezados.has(campo),
  );
  for (const fila of lectura.filas) {
    const clave = claveFila(fila, config.claves);
    const anteriores = clave ? indice.get(clave) : undefined;
    if (!anteriores) continue;
    for (const campo of ausentes) {
      const valores = new Set(
        anteriores.map((anterior) =>
          normalizarTextoPortafolio(anterior[campo]),
        ),
      );
      if (valores.size > 1) {
        throw new ErrorFormatoPortafolio(
          'Falta "' +
          campo +
          '" en "' +
          lectura.tipo +
          '" y hay varios valores anteriores posibles. Identifica la columna antes de importar.',
        );
      }
      fila[campo] = anteriores[0][campo] ?? null;
    }
  }
}
