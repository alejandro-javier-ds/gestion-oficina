// lib/whatsapp/plantillas.ts
// Plantillas de las seis campañas de Gestiones.

export type CampanaWhatsapp =
  | "sin_contacto"
  | "acuerdo_pago"
  | "contactados"
  | "renuente"
  | "remate_proceso"
  | "casos_especiales";

export type VariablesMensajeWhatsapp = {
  cliente: string;
  gestor?: string;
  presentacion?: string;
  numeroSalida: string;
  fechaPdp?: string;
  montoPdp?: string;
};

export type PlantillaWhatsapp = {
  id: CampanaWhatsapp;
  nombre: string;
  texto: string;
};

export const PLANTILLAS_WHATSAPP: Record<CampanaWhatsapp, PlantillaWhatsapp> = {
  sin_contacto: {
    id: "sin_contacto",
    nombre: "Sin contacto",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {PRESENTACION} del Estudio Caillaux, por encargo del banco BCP, respecto de su obligación pendiente de solución. Para mayor información y conocer facilidades de pago disponibles, comuníquese con nosotros al número {NUMERO_SALIDA}.",
  },

  acuerdo_pago: {
    id: "acuerdo_pago",
    nombre: "Acuerdo de pago",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {PRESENTACION} del Estudio Caillaux por encargo del banco BCP. Le recordamos que tiene un acuerdo de pago pendiente de cumplimiento. Es importante que cumpla con lo acordado para mantener las condiciones y beneficios otorgados. Para cualquier consulta o coordinación puede comunicarse con nosotros al número {NUMERO_SALIDA}.",
  },

  contactados: {
    id: "contactados",
    nombre: "Contactados",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {PRESENTACION} del Estudio Caillaux por encargo del banco BCP. Me comunico con usted para saber si tiene alguna respuesta respecto de una posible propuesta de cancelación de su obligación para el presente mes. Quedamos atentos a su respuesta. Para cualquier consulta o coordinación puede comunicarse con nosotros al número {NUMERO_SALIDA}.",
  },

  renuente: {
    id: "renuente",
    nombre: "Renuente",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {PRESENTACION} del Estudio Caillaux por encargo del banco BCP. Le recordamos que a la fecha la obligación que tiene pendiente sigue incrementando intereses y el proceso se sigue impulsando. Le recomendamos que pueda comunicarse a fin de buscar una alternativa que permita llegar a un acuerdo antes de que el proceso avance a la etapa de remate. Puede comunicarse con nosotros al número {NUMERO_SALIDA}.",
  },

  remate_proceso: {
    id: "remate_proceso",
    nombre: "Remate / Proceso judicial",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {PRESENTACION} del Estudio Caillaux por encargo del banco BCP. Nos comunicamos con usted respecto de la situación actual de su obligación y del proceso judicial asociado. Recomendamos comunicarse con nosotros a la brevedad para revisar las alternativas disponibles y evitar que el proceso continúe avanzando. Puede comunicarse con nosotros al número {NUMERO_SALIDA}.",
  },

  casos_especiales: {
    id: "casos_especiales",
    nombre: "Casos especiales",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {PRESENTACION} del Estudio Caillaux por encargo del banco BCP. Nos comunicamos con usted respecto de una información pendiente relacionada con su obligación. Para revisar su situación y recibir orientación sobre los pasos correspondientes, puede comunicarse con nosotros al número {NUMERO_SALIDA}.",
  },
};

export function obtenerPlantilla(campana: CampanaWhatsapp): string {
  return PLANTILLAS_WHATSAPP[campana]?.texto ?? "";
}

export function reemplazarVariablesMensaje(
  plantilla: string,
  variables: VariablesMensajeWhatsapp,
): string {
  return plantilla
    .replaceAll("{CLIENTE}", variables.cliente)
    .replaceAll("{GESTOR}", variables.gestor ?? "")
    .replaceAll("{PRESENTACION}", variables.presentacion ?? "")
    .replaceAll("{NUMERO_SALIDA}", variables.numeroSalida)
    .replaceAll("{FECHA_PDP}", variables.fechaPdp ?? "")
    .replaceAll("{MONTO_PDP}", variables.montoPdp ?? "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

export function tieneVariables(plantilla: string): boolean {
  return /\{[A-Z_]+\}/.test(plantilla);
}
