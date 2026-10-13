import { NextResponse } from "next/server";
import type { DatosSesion } from "@/lib/auth";
import { consultarUno } from "@/lib/postgres";
import { esNumeroWhatsappValido, normalizarNumeroWhatsapp, obtenerUsuarioSesionTemporal } from "./playwright";
import { ErrorWhatsapp } from "./errores";

export const CABECERAS_VINCULACION = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export function validarUsuarioVinculacion(sesion: DatosSesion | null): DatosSesion {
  if (!sesion) throw new ErrorWhatsapp("NO_AUTENTICADO", "No autenticado.", 401);
  if (sesion.debeCambiarContrasena) throw new ErrorWhatsapp("CAMBIO_CONTRASENA_REQUERIDO", "Debes cambiar tu contraseña antes de continuar.", 403);
  if (sesion.rol !== "administrador" && sesion.rol !== "supervisor") throw new ErrorWhatsapp("ROL_NO_AUTORIZADO", "Solo administrador o supervisor pueden vincular números de WhatsApp.", 403);
  return sesion;
}

export async function autorizarNumeroVinculacion(sesion: DatosSesion, entrada: string, nuevaTemporal = false) {
  validarUsuarioVinculacion(sesion);
  if (!esNumeroWhatsappValido(entrada)) throw new ErrorWhatsapp("NUMERO_INVALIDO", "Ingresa un celular peruano válido de 9 dígitos.", 400);
  const numero = normalizarNumeroWhatsapp(entrada);
  const propietarioTemporal = await obtenerUsuarioSesionTemporal(numero, sesion);
  if (propietarioTemporal !== null && propietarioTemporal !== sesion.userId) throw new ErrorWhatsapp("NUMERO_NO_AUTORIZADO", "No tienes permiso para acceder a ese número.", 403);
  const registrado = await consultarUno<{ activo: number }>("SELECT activo::int AS activo FROM whatsapp_numeros WHERE numero = $1", [numero]);
  if (registrado && registrado.activo !== 1) throw new ErrorWhatsapp("NUMERO_NO_AUTORIZADO", "No tienes permiso para acceder a ese número.", 403);
  if (!registrado && propietarioTemporal !== sesion.userId && !nuevaTemporal) throw new ErrorWhatsapp("NUMERO_NO_AUTORIZADO", "No tienes permiso para acceder a ese número.", 403);
  return { numero, temporal: !registrado };
}

export async function actualizarPermisoEnvioWhatsapp(sesion: DatosSesion, numero: string): Promise<DatosSesion> {
  const usuario = await consultarUno<{ rol: DatosSesion["rol"]; debe_cambiar_contrasena: number }>(
    "SELECT rol, debe_cambiar_contrasena FROM usuarios WHERE id = $1 AND username = $2 AND activo = 1",
    [sesion.userId, sesion.username],
  );
  if (!usuario) throw new ErrorWhatsapp("NO_AUTENTICADO", "La cuenta ya no tiene acceso al CRM.", 401);
  const actual = validarUsuarioVinculacion({ ...sesion, rol: usuario.rol, debeCambiarContrasena: usuario.debe_cambiar_contrasena === 1 });
  await autorizarNumeroVinculacion(actual, numero);
  return actual;
}

export function respuestaErrorVinculacion(error: unknown) {
  const conocido = error instanceof ErrorWhatsapp;
  const status = conocido ? error.status : 503;
  const codigo = conocido ? error.codigo : "WHATSAPP_NO_DISPONIBLE";
  if (status >= 500) console.error(`[WhatsApp vinculación] ${codigo}`);
  return NextResponse.json({ error: conocido ? error.message : "No se pudo consultar WhatsApp Web. Intenta nuevamente.", codigo }, { status, headers: CABECERAS_VINCULACION });
}
