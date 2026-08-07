// lib/mapeo-columnas.ts
// Traduce los nombres de columna del Excel del banco a los nombres
// que usamos en nuestra base de datos.

export const MAPEO_CUENTAS: Record<string, string> = {
  CODCUENTACOBRANZA: "codcuentacobranza",
  IDC: "idc",
  CLIENTE: "cliente",
  EXPEDIENTE: "expediente",
  FUNCIONARIO: "funcionario",
  GESTOR: "gestor",
  MTODEUDA_SOL: "mtodeuda_sol",
  MTODEUDAVENCIDA_SOL: "mtodeudavencida_sol",

  CODMONEDA: "codmoneda",
  DEUDATOTAL_MONEDAORIGEN: "deudatotal_monedaorigen",
  DEUDAVENCIDA_MONEDAORIGEN: "deudavencida_monedaorigen",

  DTP: "dtp",
  ESTADO_CARTERA: "estado_cartera",
  ETAPA_PROCESAL: "etapa_procesal",
  DIASMORA: "diasmora",
  RANGO_MORA: "rango_mora",
  PRIORIDAD: "prioridad",
  SEGMENTACION: "segmentacion",
  DESCPRODUCTO: "descproducto",
  DIRECCION: "direccion",
  DISTRITO: "distrito",
  DEPARTAMENTO: "departamento",
  ROUTER: "router",
  CLASIF_RIESGOBCP: "nivel_riesgo",
  TIPO_JUICIO: "tipo_juicio",
  FEC_DEMANDA: "fec_demanda",
  FEC_ENTREGA_LEGAJO_A_ESTUDIO: "fec_entrega_legajo_a_estudio",
};

export const DESCRIPCION_ROUTER: Record<string, string> = {
  LGM: "Legal SDP",
  PLM: "Pre Legal SDP",
  ACQ: "Cartera Comprada",
  TRC: "Telefonía",
  PGS: "Pre gestión de telefonía interna",
};

export const MAPEO_GARANTIAS: Record<string, string> = {
  GAR_CODIGO: "gar_codigo",
  IDC: "idc",
  CLIENTE: "cliente",
  TIPO_GARANTIA: "tipo_garantia",
  GAR_DESCRIPCION: "descripcion",
  GAR_MONEDA: "moneda",
  MTOCOMERCIALTASACION: "monto_comercial",
  MTOAFECTACION: "monto_afectacion",
  MTOREALIZACIONTASACION: "monto_realizacion",
  FUNCIONARIO: "funcionario",
};

export const MAPEO_APERSONAMIENTO: Record<string, string> = {
  IDC: "idc",
  CODCUENTACOBRANZA: "codcuentacobranza",
  CLIENTE: "cliente",
  DESGRUPOFUNCIONAL: "desgrupofuncional",
  FEC_ASIGNACION_LGM: "fec_asignacion_lgm",
  FECHA_ENTREGA: "fecha_entrega",
  MOTIVO: "motivo",
  MONTODEUDATOTAL: "montodeudatotal",
};

export const FUNCIONARIOS_PERMITIDOS = [
  "Gisella Alvarado Loayza",
  "Imelda Dilma Cerrutti Depaz",
  "Luis Mendoza V",
];

export function clasificarTelefono(
  numero: string,
): "celular" | "fijo" | "revisar" {
  const limpio = String(numero).trim();
  if (limpio.length === 9 && limpio.startsWith("9")) return "celular";
  if (limpio.length === 7) return "fijo";
  return "revisar";
}
