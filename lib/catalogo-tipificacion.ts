// lib/catalogo-tipificacion.ts
// Catálogo de categorías y razones.

export type OpcionCatalogo = { codigo: string; descripcion: string };

export const RAZONES_TAT: OpcionCatalogo[] = [
  { codigo: "CE", descripcion: "Cliente evasivo" },
  { codigo: "DN", descripcion: "Desastre natural" },
  { codigo: "GE", descripcion: "Gasto extraordinario" },
  { codigo: "DA", descripcion: "Difícil acceso pago" },
  { codigo: "DI", descripcion: "Baja venta/Comisiones/Nuevo trabajo" },
  { codigo: "FR", descripcion: "Posible fraude" },
  { codigo: "RP", descripcion: "Reclamo pendiente" },
  { codigo: "PP", descripcion: "Problemas permanentes de ingresos" },
  { codigo: "OP", descripcion: "Olvidó realizar el pago" },
  { codigo: "RO", descripcion: "Robo/Extorsión/Estafa/Desalojo" },
  { codigo: "SC", descripcion: "Siniestro casero" },
  { codigo: "CO", descripcion: "Cambio organizacional" },
  { codigo: "GR", descripcion: "Garantía rematada" },
  { codigo: "PJ", descripcion: "Poder judicial cerrado" },
  { codigo: "CL", descripcion: "Cliente litigando" },
  { codigo: "FA", descripcion: "Cliente fallecido" },
];

export const RAZONES_MCT: OpcionCatalogo[] = RAZONES_TAT;

export const RAZONES_TIN: OpcionCatalogo[] = RAZONES_TAT;

export const OTRAS_GESTIONES: OpcionCatalogo[] = [
  { codigo: "RPP", descripcion: "Recordar promesa" },
  { codigo: "CAN", descripcion: "Cliente canceló" },
  { codigo: "JFA", descripcion: "Cliente fallecido (Judicial)" },
  { codigo: "MGR", descripcion: "Mensaje en grabadora" },
  { codigo: "CBP", descripcion: "Carta bajo puerta" },
  { codigo: "SMS", descripcion: "Envío de mensaje de texto" },
  { codigo: "CRU", descripcion: "Cuentas renuentes" },
  { codigo: "INU", descripcion: "Inubicable" },
  { codigo: "NEG", descripcion: "En negociación" },
  { codigo: "TNC", descripcion: "Teléfono no contesta" },
  { codigo: "MCW", descripcion: "Mensaje por correo/WhatsApp" },
];

export const TIPOS_PROMESA_PAGO: OpcionCatalogo[] = [
  { codigo: "PAR", descripcion: "Promesa de pago parcial" },
  { codigo: "PCS", descripcion: "Promesa de pago castigo en saldo" },
  { codigo: "PDP", descripcion: "Promesa de pago" },
  { codigo: "PPC", descripcion: "Promesa de pago de condonación" },
];

export const MODALIDADES_PAGO: OpcionCatalogo[] = [
  { codigo: "ARM", descripcion: "Pago en una sola armada" },
  { codigo: "AMR", descripcion: "Amortización" },
  { codigo: "CAT", descripcion: "Cancelación total" },
  { codigo: "REF", descripcion: "Refinanciación" },
  { codigo: "REP", descripcion: "Reprogramación de cuotas" },
  { codigo: "CJU", descripcion: "Consignación judicial" },
  { codigo: "PCD", descripcion: "Pago con descuento" },
];

export const TIPOS_NEGOCIACION: string[] = [
  "Amortización con Acuerdo",
  "Amortización sin Acuerdo",
  "Cancelación",
  "En Negociación",
];

export const BENEFICIOS: string[] = ["Con Condonación", "Sin Condonación"];

export const STATUS_PDP: string[] = [
  "Posible Pago",
  "100% Confiable",
  "Fin de Acuerdo",
];

export const STATUS_PAGO: string[] = ["Pendiente", "Pago", "Canceló"];

export const ESTUDIO_FIJO = "CONSULTORIA JCYE";
export const MATRIZ_FIJA = "LIMA";
export const TIPO_CAMBIO_REFERENCIAL = 3.41;

export const SEGMENTACIONES: string[] = [
  "RENUENTE",
  "NO CONTACTO",
  "CONTACTO CON NEGOCIACION",
  "CONTACTO SIN NEGOCIACION",
  "REMATADO",
  "CANCELADO",
  "ACUERDO DE PAGO",
  "NO CONTACTO - NUEVO",
  "CONSIGNACION JUDICIAL",
  "NO ASIGNADO",
  "SUSPENSION DE REMATE",
  "FALLECIDO",
];

export const SEGMENTACION_FIJA_PDP = "CONTACTO CON NEGOCIACION";
