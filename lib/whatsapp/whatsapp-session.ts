import { enviarUnMensajeWhatsapp as enviar, type ResultadoEnvioWhatsapp } from "./envio";
import type { ActorWhatsapp } from "./playwright";

export async function enviarUnMensajeWhatsapp({ numeroSalida, numeroDestino, mensaje, actor, idEnvio }: {
  numeroSalida: string; numeroDestino: string; mensaje: string; actor?: ActorWhatsapp; idEnvio?: string;
}): Promise<ResultadoEnvioWhatsapp & { numeroDestino: string }> {
  const resultado = await enviar(numeroSalida, numeroDestino, mensaje, actor, idEnvio);
  return { ...resultado, numeroDestino: resultado.telefonoDestino };
}
