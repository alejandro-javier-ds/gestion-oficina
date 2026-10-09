// lib/whatsapp/plantillas-pdp.ts

export type CampanaPdpWhatsapp =
  | "posible_pago"
  | "cien_confiable"
  | "fin_acuerdo";

export type VariablesMensajePdp = {
  cliente: string;
  gestor: string;
  numeroSalida: string;
  numeroContactoGestor?: string;
  saludoGestor?: string;
  montoPdp?: string;
  fechaPdp?: string;
};

export type PlantillaPdpWhatsapp = {
  id: CampanaPdpWhatsapp;
  nombre: string;
  texto: string;
};

export const PLANTILLAS_PDP: Record<CampanaPdpWhatsapp, PlantillaPdpWhatsapp> =
{
  posible_pago: {
    id: "posible_pago",
    nombre: "Posible Pago",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {SALUDO_GESTOR} Estudio Caillaux, por encargo del banco BCP. Nos comunicamos con usted respecto de la propuesta de pago que se viene evaluando por un monto de {MONTO_PDP}, con fecha prevista de pago {FECHA_PDP}. Agradeceremos nos pueda confirmar si mantiene su intención de realizar el pago conversado, a fin de poder continuar con las coordinaciones correspondientes. Para cualquier consulta o coordinación, puede comunicarse con nosotros al número {NUMERO_CONTACTO_GESTOR}.",
  },

  cien_confiable: {
    id: "cien_confiable",
    nombre: "100% Confiable",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {SALUDO_GESTOR} Estudio Caillaux, por encargo del banco BCP. Nos comunicamos con usted respecto de su compromiso de pago por un monto de {MONTO_PDP}, con fecha de pago {FECHA_PDP}. Agradeceremos pueda confirmar que mantiene las condiciones acordadas para continuar con las coordinaciones correspondientes. Para cualquier consulta o coordinación, puede comunicarse con nosotros al número {NUMERO_CONTACTO_GESTOR}.",
  },

  fin_acuerdo: {
    id: "fin_acuerdo",
    nombre: "Fin de Acuerdo",
    texto:
      "Estimado Sr(a) {CLIENTE}, buen día. {SALUDO_GESTOR} Estudio Caillaux, por encargo del banco BCP. Nos comunicamos con usted respecto de la culminación de su acuerdo de pago, registrado por un monto de {MONTO_PDP}, con fecha {FECHA_PDP}. Para cualquier consulta o coordinación relacionada con su obligación, puede comunicarse con nosotros al número {NUMERO_CONTACTO_GESTOR}.",
  },
};

function normalizarTexto(valor: string): string {
  return valor
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export function obtenerSaludoGestorPdp(
  gestor: string,
  propietario?: string,
  propietarioTipo?: string,
): string {
  const normalizar = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const propietarioNormalizado = normalizar(propietario ?? "");
  const tipoNormalizado = normalizar(propietarioTipo ?? "");

  const salidaSinNombre =
    propietarioNormalizado.includes("independiente") ||
    propietarioNormalizado.includes("supervisor") ||
    tipoNormalizado.includes("independiente") ||
    tipoNormalizado.includes("supervisor");

  if (salidaSinNombre) {
    return "Le saludamos del";
  }

  const nombreGestor = gestor.trim();

  return nombreGestor ? `Le saluda ${nombreGestor} del` : "Le saludamos del";
}

export function obtenerPlantillaPdp(campana: CampanaPdpWhatsapp): string {
  return PLANTILLAS_PDP[campana]?.texto ?? "";
}

export function reemplazarVariablesPdp(
  plantilla: string,
  variables: VariablesMensajePdp,
): string {
  return normalizarTexto(
    plantilla
      .replaceAll("{CLIENTE}", variables.cliente)
      .replaceAll("{GESTOR}", variables.gestor)
      .replaceAll(
        "{SALUDO_GESTOR}",
        variables.saludoGestor ?? `Le saluda ${variables.gestor} del`,
      )
      .replaceAll("{NUMERO_SALIDA}", variables.numeroSalida)
      .replaceAll(
        "{NUMERO_CONTACTO_GESTOR}",
        variables.numeroContactoGestor ?? "",
      )
      .replaceAll("{FECHA_PDP}", variables.fechaPdp ?? "")
      .replaceAll("{MONTO_PDP}", variables.montoPdp ?? ""),
  );
}

export function tieneVariablesPdp(plantilla: string): boolean {
  return /\{[A-Z_]+\}/.test(plantilla);
}
