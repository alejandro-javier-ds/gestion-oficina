import { createHash, randomUUID } from "node:crypto";
import { enviarUnMensajeWhatsapp as enviarLocal, type ResultadoEnvioWhatsapp } from "./envio-local";
import { operarWhatsappRemoto, whatsappRemoto, normalizarNumeroWhatsapp, type ActorWhatsapp } from "./playwright";

export type { ResultadoEnvioWhatsapp } from "./envio-local";
export function identificadorEnvioWhatsapp(campanaId: number, destinatarioId: number) {
  const hash = createHash("sha256").update(`crm-whatsapp-v1:${campanaId}:${destinatarioId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export async function enviarUnMensajeWhatsapp(numeroSalida: string, destino: string, mensaje: string, actor?: ActorWhatsapp, idEnvio: string = randomUUID(), leaseId?: string | null): Promise<ResultadoEnvioWhatsapp> {
  if (!whatsappRemoto()) return enviarLocal(numeroSalida, destino, mensaje);
  if (!leaseId) return { ok: false, numeroSalida: normalizarNumeroWhatsapp(numeroSalida), telefonoDestino: normalizarNumeroWhatsapp(destino), mensaje: mensaje.trim(),
    estado: "ERROR", detalle: "El envío no pertenece a una campaña activa.", duracionMs: 0 };
  try {
    const resultado = await operarWhatsappRemoto<Omit<ResultadoEnvioWhatsapp, "mensaje">>("enviar", normalizarNumeroWhatsapp(numeroSalida),
      { destino: normalizarNumeroWhatsapp(destino), mensaje: mensaje.trim(), idEnvio, leaseId }, actor);
    return { ...resultado, mensaje: mensaje.trim() };
  } catch {
    return { ok: false, numeroSalida: normalizarNumeroWhatsapp(numeroSalida), telefonoDestino: normalizarNumeroWhatsapp(destino), mensaje: mensaje.trim(),
      estado: "ERROR", detalle: "Resultado remoto no confirmado. No reintentar automáticamente; revisa WhatsApp y el registro del servicio antes de otro envío.", duracionMs: 0 };
  }
}
