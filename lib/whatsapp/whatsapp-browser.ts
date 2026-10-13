import { iniciarWhatsapp, obtenerEstadoWhatsapp, obtenerEstadosWhatsapp, obtenerPaginaWhatsapp, whatsappRemoto, normalizarNumeroWhatsapp, esNumeroWhatsappValido } from "./playwright";
import { cerrarWhatsapp } from "./playwright-local";
import { ErrorWhatsapp } from "./errores";

export type EstadoWhatsapp = "conectado" | "desconectado" | "iniciando";
export type SesionWhatsapp = { id: string; numero: string; estado: EstadoWhatsapp };

export function obtenerPerfilNumero(numero: string): string | null {
  return esNumeroWhatsappValido(numero) ? normalizarNumeroWhatsapp(numero) : null;
}
export async function abrirSesionWhatsapp(numero: string) {
  if (whatsappRemoto()) throw new ErrorWhatsapp("CHROMIUM_REMOTO", "Utiliza las operaciones autorizadas del servicio de WhatsApp en la VM.", 409);
  await iniciarWhatsapp(numero);
  const page = obtenerPaginaWhatsapp(numero);
  if (!page) throw new ErrorWhatsapp("SESION_NO_DISPONIBLE", "La sesión de WhatsApp no está disponible.");
  return { id: numero, numero, page, context: page.context() };
}
export async function obtenerEstadoSesiones(): Promise<SesionWhatsapp[]> {
  if (whatsappRemoto()) throw new ErrorWhatsapp("CHROMIUM_REMOTO", "Consulta los estados mediante la API autorizada del CRM.", 409);
  return (await obtenerEstadosWhatsapp()).map((sesion) => ({ id: sesion.numero, numero: sesion.numero,
    estado: sesion.conectado ? "conectado" : sesion.estado === "conectando" ? "iniciando" : "desconectado" }));
}
export async function cerrarSesionWhatsapp(numero: string) {
  if (whatsappRemoto()) throw new ErrorWhatsapp("CHROMIUM_REMOTO", "El cierre del perfil permanente se administra en la VM.", 409);
  await obtenerEstadoWhatsapp(numero);
  await cerrarWhatsapp(numero);
}
