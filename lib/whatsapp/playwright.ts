import * as local from "./playwright-local";
import { crearClienteWhatsapp, modoWhatsapp, type ActorWhatsapp, ErrorRemotoWhatsapp } from "../../docker/whatsapp-wire.mjs";
import { ErrorWhatsapp } from "./errores";

export type { EstadoConexionWhatsapp, EstadoSesionWhatsapp } from "./playwright-local";
export type { ActorWhatsapp } from "../../docker/whatsapp-wire.mjs";
export { normalizarNumeroWhatsapp, esNumeroWhatsappValido } from "./playwright-local";

let cliente: ReturnType<typeof crearClienteWhatsapp> | undefined;
export function whatsappRemoto() { return modoWhatsapp() === "remote"; }
export async function operarWhatsappRemoto<T>(op: string, numero: string | undefined, payload: Record<string, unknown>, actor?: ActorWhatsapp): Promise<T> {
  if (!actor) throw new ErrorWhatsapp("OPERACION_NO_AUTORIZADA", "Se requiere una sesión autorizada para controlar WhatsApp.", 403);
  try {
    cliente ??= crearClienteWhatsapp();
    return await cliente.operar({ op, numero, payload }, actor) as T;
  } catch (error) {
    if (error instanceof ErrorRemotoWhatsapp) throw new ErrorWhatsapp(error.codigo, error.message, error.status);
    throw new ErrorWhatsapp("SERVICIO_WHATSAPP", "La VM de WhatsApp no está disponible; los perfiles se conservan.");
  }
}
type Metadatos = { iniciado: boolean; temporal: boolean; usuarioTemporalId: number | null; visor: { id: string; remoto: true } | null };
function metadatos(numero: string, actor?: ActorWhatsapp) {
  return operarWhatsappRemoto<Metadatos>("metadatos", local.normalizarNumeroWhatsapp(numero), {}, actor);
}
export async function iniciarWhatsapp(numero: string, temporal = false, usuarioTemporalId?: number, actor?: ActorWhatsapp) {
  return whatsappRemoto() ? operarWhatsappRemoto<local.EstadoSesionWhatsapp>("iniciar", local.normalizarNumeroWhatsapp(numero), { temporal }, actor)
    : local.iniciarWhatsapp(numero, temporal, usuarioTemporalId);
}
export async function obtenerEstadoWhatsapp(numero: string, actor?: ActorWhatsapp) {
  return whatsappRemoto() ? operarWhatsappRemoto<local.EstadoSesionWhatsapp>("estado", local.normalizarNumeroWhatsapp(numero), {}, actor) : local.obtenerEstadoWhatsapp(numero);
}
export async function obtenerEstadosWhatsapp(numeros?: string[], actor?: ActorWhatsapp) {
  if (!whatsappRemoto()) return local.obtenerEstadosWhatsapp(numeros);
  return Promise.all((numeros ?? []).map((numero) => obtenerEstadoWhatsapp(numero, actor)));
}
export async function obtenerVinculacionWhatsapp(numero: string, actor?: ActorWhatsapp) {
  return whatsappRemoto() ? operarWhatsappRemoto<local.EstadoSesionWhatsapp & { qr: string | null }>("qr", local.normalizarNumeroWhatsapp(numero), {}, actor) : local.obtenerVinculacionWhatsapp(numero);
}
export async function iniciarReservaCampanaWhatsapp(campanaId: number, actor?: ActorWhatsapp) {
  if (!whatsappRemoto()) return null;
  const resultado = await operarWhatsappRemoto<{ leaseId: string }>("campana", undefined, { accion: "iniciar", campanaId }, actor);
  return resultado.leaseId;
}
export async function finalizarReservaCampanaWhatsapp(campanaId: number, leaseId: string, actor?: ActorWhatsapp) {
  if (whatsappRemoto()) return operarWhatsappRemoto<{ ok: boolean; liberada: boolean }>("campana", undefined, { accion: "finalizar", campanaId, leaseId }, actor);
  return { ok: true, liberada: false };
}
export async function cerrarYEliminarWhatsappTemporal(numero: string, actor?: ActorWhatsapp) {
  if (whatsappRemoto()) await operarWhatsappRemoto("cerrarTemporal", local.normalizarNumeroWhatsapp(numero), {}, actor);
  else await local.cerrarYEliminarWhatsappTemporal(numero);
}
export async function iniciarWhatsappParaEnvio(numero: string, temporal = false, tiempoEsperaMs = 20_000, actor?: ActorWhatsapp) {
  if (!whatsappRemoto()) return local.iniciarWhatsappParaEnvio(numero, temporal, tiempoEsperaMs);
  let estado = await iniciarWhatsapp(numero, temporal, actor?.userId, actor);
  const limite = Date.now() + tiempoEsperaMs;
  while (!estado.conectado && !estado.qrVisible && Date.now() < limite) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    estado = await obtenerEstadoWhatsapp(numero, actor);
  }
  return estado;
}
export async function existeSesionWhatsapp(numero: string, actor?: ActorWhatsapp) { return whatsappRemoto() ? (await metadatos(numero, actor)).iniciado : local.existeSesionWhatsapp(numero); }
export async function esSesionWhatsappTemporal(numero: string, actor?: ActorWhatsapp) { return whatsappRemoto() ? (await metadatos(numero, actor)).temporal : local.esSesionWhatsappTemporal(numero); }
export async function obtenerUsuarioSesionTemporal(numero: string, actor?: ActorWhatsapp) { return whatsappRemoto() ? (await metadatos(numero, actor)).usuarioTemporalId : local.obtenerUsuarioSesionTemporal(numero); }
export async function obtenerNumerosTemporalesUsuario(usuarioId: number, actor?: ActorWhatsapp) {
  if (whatsappRemoto() && actor?.userId !== usuarioId) throw new ErrorWhatsapp("OPERACION_NO_AUTORIZADA", "No tienes permiso para consultar esas sesiones.", 403);
  return whatsappRemoto() ? operarWhatsappRemoto<string[]>("temporales", undefined, {}, actor) : local.obtenerNumerosTemporalesUsuario(usuarioId);
}
export async function obtenerEscritorioWhatsapp(numero: string, actor?: ActorWhatsapp) { return whatsappRemoto() ? (await metadatos(numero, actor)).visor : local.obtenerEscritorioWhatsapp(numero); }
export function obtenerPaginaWhatsapp(numero: string) {
  if (whatsappRemoto()) throw new ErrorWhatsapp("CHROMIUM_REMOTO", "El navegador se controla exclusivamente en la VM.", 409);
  return local.obtenerPaginaWhatsapp(numero);
}
export async function cerrarWhatsapp(numero: string) {
  if (whatsappRemoto()) throw new ErrorWhatsapp("CHROMIUM_REMOTO", "El cierre de perfiles permanentes se administra en la VM.", 409);
  await local.cerrarWhatsapp(numero);
}
