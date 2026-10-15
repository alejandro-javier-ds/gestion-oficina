export type EstadoResultadoEnvioWhatsapp = "ENVIADO" | "ERROR" | "INCIERTO";

export async function esperarConfirmacionWhatsapp(
  consultar: () => Promise<EstadoResultadoEnvioWhatsapp>,
  timeoutMs: number,
  intervaloMs = 200,
): Promise<EstadoResultadoEnvioWhatsapp> {
  const limite = Date.now() + Math.max(0, timeoutMs);

  while (true) {
    const estado = await consultar();
    if (estado !== "INCIERTO") return estado;

    const restante = limite - Date.now();
    if (restante <= 0) return "INCIERTO";

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(Math.max(1, intervaloMs), restante)),
    );
  }
}

export function normalizarTextoMensajeWhatsapp(valor: string): string {
  return valor
    .normalize("NFC")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tiempoConfirmacionWhatsapp(
  valor = process.env.WHATSAPP_SEND_CONFIRM_TIMEOUT_MS,
): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return 15_000;
  return Math.min(30_000, Math.max(5_000, Math.trunc(numero)));
}

export function destinoCoincideConChatWhatsapp(
  urlEntrada: string,
  telefonoEntrada: string,
): boolean {
  try {
    const url = new URL(urlEntrada);
    if (url.hostname !== "web.whatsapp.com") return false;
    const recibido = (url.searchParams.get("phone") ?? "").replace(/\D/g, "");
    const telefono = telefonoEntrada.replace(/\D/g, "");
    return recibido === telefono || recibido === `51${telefono}`;
  } catch {
    return false;
  }
}

export function evaluarConfirmacionEnvioWhatsapp(entrada: {
  destinoCoincide: boolean;
  mensajeNuevoCoincide: boolean;
  confirmacionVisible: boolean;
  errorVisible: boolean;
  accionIniciada: boolean;
}): EstadoResultadoEnvioWhatsapp {
  if (entrada.errorVisible) return "ERROR";
  if (
    entrada.destinoCoincide &&
    entrada.mensajeNuevoCoincide &&
    entrada.confirmacionVisible
  )
    return "ENVIADO";
  return entrada.accionIniciada ? "INCIERTO" : "ERROR";
}

export function esErrorRemotoPrevioAlEnvio(
  codigo: string | undefined,
  status: number | undefined,
): boolean {
  if (status !== undefined && status >= 400 && status < 500 && status !== 408)
    return true;
  return [
    "CONFIGURACION_WHATSAPP",
    "CERTIFICADO_WHATSAPP",
    "SERVICIO_NO_LISTO",
    "SERVICIO_OCUPADO",
    "MANTENIMIENTO_WHATSAPP",
    "SESION_OCUPADA",
    "CAMPANA_NO_AUTORIZADA",
    "NUMERO_NO_AUTORIZADO",
    "ENVIO_INVALIDO",
    "OPERACION_NO_AUTORIZADA",
  ].includes(codigo ?? "");
}
