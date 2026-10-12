import { chromium, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { ErrorWhatsapp } from "./errores";
import { esPaginaWhatsapp, leerVinculacionPagina } from "./qr";
import { prepararPerfilWhatsapp } from "./perfil";

const CARPETA_SESIONES = path.join(process.cwd(), "whatsapp-sessions");
const CARPETA_TEMPORALES = path.join(CARPETA_SESIONES, ".temporales");
const URL_WHATSAPP = "https://web.whatsapp.com/";

export type EstadoConexionWhatsapp = "conectado" | "no_vinculado" | "desconectado" | "conectando" | "error";
export type EstadoSesionWhatsapp = {
  numero: string;
  iniciado: boolean;
  conectado: boolean;
  qrVisible: boolean;
  paginaAbierta: boolean;
  temporal: boolean;
  estado: EstadoConexionWhatsapp;
  mensaje: string;
};

type SesionWhatsappInterna = {
  numero: string;
  contexto: BrowserContext;
  pagina: Page;
  temporal: boolean;
  usuarioTemporalId: number | null;
  carpeta: string;
  control: Awaited<ReturnType<typeof prepararPerfilWhatsapp>>;
};
type VinculacionWhatsapp = EstadoSesionWhatsapp & { qr: string | null };
type RegistroWhatsapp = {
  sesiones: Map<string, SesionWhatsappInterna>;
  iniciando: Map<string, Promise<EstadoSesionWhatsapp>>;
  lecturas: Map<string, Promise<VinculacionWhatsapp>>;
  errores: Map<string, ErrorWhatsapp>;
  cerrando: Map<string, Promise<void>>;
  apagadoRegistrado?: boolean;
};
const globalWhatsapp = globalThis as typeof globalThis & { __gestionWhatsapp?: RegistroWhatsapp };
const registro: RegistroWhatsapp = globalWhatsapp.__gestionWhatsapp ??= {
  sesiones: new Map(), iniciando: new Map(), lecturas: new Map(), errores: new Map(), cerrando: new Map(),
};
const { sesiones, iniciando, lecturas, errores, cerrando } = registro;

function normalizarNumero(numero: string): string {
  const limpio = numero.replace(/\D/g, "");
  return limpio.length === 11 && limpio.startsWith("51") ? limpio.slice(2) : limpio;
}
function validarNumero(numeroEntrada: string): string {
  const numero = normalizarNumero(numeroEntrada);
  if (!esNumeroWhatsappValido(numeroEntrada)) throw new ErrorWhatsapp("NUMERO_INVALIDO", "El número de WhatsApp debe ser un celular peruano válido de 9 dígitos.", 400);
  return numero;
}
function obtenerCarpetaSesion(numero: string): string {
  return path.join(CARPETA_SESIONES, numero);
}
function existePerfilSesion(numero: string): boolean {
  try {
    return fs.readdirSync(obtenerCarpetaSesion(numero)).some((nombre) => !nombre.startsWith(".crm-") && !nombre.startsWith("Singleton"));
  } catch {
    return false;
  }
}
function construirEstadoSinSesion(numero: string): EstadoSesionWhatsapp {
  const tienePerfil = existePerfilSesion(numero);
  const fallo = errores.get(numero);
  return {
    numero, iniciado: false, conectado: false, qrVisible: false, paginaAbierta: false, temporal: false,
    estado: iniciando.has(numero) ? "conectando" : fallo ? "error" : tienePerfil ? "desconectado" : "no_vinculado",
    mensaje: iniciando.has(numero) ? "WhatsApp Web está iniciándose." : fallo?.message ?? (tienePerfil
      ? "Existe una sesión guardada, pero WhatsApp Web no está conectado."
      : "Este número todavía no está vinculado a WhatsApp Web."),
  };
}
async function leerEstado(numero: string, incluirQr: boolean): Promise<VinculacionWhatsapp> {
  const sesion = sesiones.get(numero);
  if (!sesion || sesion.pagina.isClosed()) return { ...construirEstadoSinSesion(numero), qr: null };
  try {
    const conexion = await leerVinculacionPagina(sesion.pagina, incluirQr);
    if (sesiones.get(numero) !== sesion || sesion.pagina.isClosed()) return { ...construirEstadoSinSesion(numero), qr: null };
    return {
      numero, iniciado: true, paginaAbierta: true, temporal: sesion.temporal,
      conectado: conexion.conectado, qrVisible: conexion.qrVisible, qr: conexion.qr,
      estado: conexion.conectado ? "conectado" : "conectando",
      mensaje: conexion.conectado
        ? sesion.temporal ? "WhatsApp Web conectado. Esta es una sesión temporal." : "WhatsApp Web conectado y listo para utilizarse."
        : conexion.qrVisible ? "Escanea este código QR desde WhatsApp en tu celular." : "WhatsApp Web está iniciándose. Esperando el código QR o la conexión.",
    };
  } catch {
    return {
      ...construirEstadoSinSesion(numero), iniciado: true, paginaAbierta: !sesion.pagina.isClosed(),
      temporal: sesion.temporal, estado: "error", mensaje: "No se pudo comprobar el estado de WhatsApp Web. Intenta reconectar.", qr: null,
    };
  }
}
async function obtenerLectura(numeroEntrada: string, incluirQr: boolean): Promise<VinculacionWhatsapp> {
  const numero = validarNumero(numeroEntrada);
  const clave = `${numero}:${incluirQr}`;
  const pendiente = lecturas.get(clave);
  if (pendiente) return pendiente;
  const lectura = leerEstado(numero, incluirQr);
  lecturas.set(clave, lectura);
  try { return await lectura; }
  finally { if (lecturas.get(clave) === lectura) lecturas.delete(clave); }
}
export async function obtenerVinculacionWhatsapp(numeroEntrada: string): Promise<VinculacionWhatsapp> {
  return obtenerLectura(numeroEntrada, true);
}
function quitarSesion(sesion: SesionWhatsappInterna) {
  if (sesiones.get(sesion.numero) === sesion) sesiones.delete(sesion.numero);
}
function registrarEventosSesion(sesion: SesionWhatsappInterna) {
  sesion.contexto.on("close", () => {
    quitarSesion(sesion);
    void sesion.control.liberar();
  });
  sesion.pagina.on("close", () => {
    if (sesiones.get(sesion.numero) === sesion) void cerrarWhatsapp(sesion.numero).catch(() => {});
  });
  sesion.pagina.on("crash", () => {
    errores.set(sesion.numero, new ErrorWhatsapp("CHROMIUM_NO_DISPONIBLE", "Chromium se detuvo. El perfil se conserva; intenta reconectar."));
    void cerrarWhatsapp(sesion.numero).catch(() => {});
  });
  sesion.control.alPerderBloqueo(() => {
    errores.set(sesion.numero, new ErrorWhatsapp("BLOQUEO_WHATSAPP", "Se perdió el bloqueo del perfil. La sesión se cerró para proteger los datos."));
    void cerrarWhatsapp(sesion.numero).catch(() => {});
  });
}
function clasificarErrorInicio(error: unknown): ErrorWhatsapp {
  if (error instanceof ErrorWhatsapp) return error;
  const detalle = error instanceof Error ? error.message : "";
  if (/Singleton|ProcessSingleton|profile.*(?:in use|locked)/i.test(detalle)) return new ErrorWhatsapp("PERFIL_OCUPADO", "El perfil de WhatsApp está ocupado por otra instancia. Se conservó sin cambios.", 409);
  return new ErrorWhatsapp("CHROMIUM_NO_DISPONIBLE", "No se pudo abrir Chromium o cargar WhatsApp Web. El perfil guardado se conserva; intenta nuevamente.");
}
async function abrirSesion(numero: string, temporal: boolean, usuarioTemporalId?: number): Promise<EstadoSesionWhatsapp> {
  let contexto: BrowserContext | undefined;
  let control: Awaited<ReturnType<typeof prepararPerfilWhatsapp>> | undefined;
  try {
    if (sesiones.has(numero)) await cerrarWhatsapp(numero);
    if (temporal && (!Number.isSafeInteger(usuarioTemporalId) || Number(usuarioTemporalId) <= 0)) {
      throw new ErrorWhatsapp("TEMPORAL_SIN_PROPIETARIO", "La sesión temporal requiere un usuario autorizado.", 403);
    }
    const carpeta = temporal ? path.join(CARPETA_TEMPORALES, numero + "-" + usuarioTemporalId) : obtenerCarpetaSesion(numero);
    control = await prepararPerfilWhatsapp(carpeta);
    contexto = await chromium.launchPersistentContext(carpeta, {
      headless: false, viewport: { width: 1440, height: 900 }, locale: "es-PE", timezoneId: "America/Lima",
      acceptDownloads: false, timeout: 30_000,
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    });
    await control.marcarAdministrado();
    const pagina = contexto.pages().find((pagina) => esPaginaWhatsapp(pagina.url())) ?? contexto.pages()[0] ?? await contexto.newPage();
    const sesion: SesionWhatsappInterna = { numero, contexto, pagina, temporal, usuarioTemporalId: temporal ? usuarioTemporalId! : null, carpeta, control };
    sesiones.set(numero, sesion);
    registrarEventosSesion(sesion);
    if (!esPaginaWhatsapp(pagina.url())) await pagina.goto(URL_WHATSAPP, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return await obtenerEstadoWhatsapp(numero);
  } catch (error) {
    try { await contexto?.close(); } catch {}
    await control?.liberar();
    const fallo = clasificarErrorInicio(error);
    errores.set(numero, fallo);
    throw fallo;
  }
}
export async function iniciarWhatsapp(numeroEntrada: string, temporal = false, usuarioTemporalId?: number): Promise<EstadoSesionWhatsapp> {
  const numero = validarNumero(numeroEntrada);
  if (cerrando.has(numero)) await cerrando.get(numero);
  const existente = sesiones.get(numero);
  if (existente && !existente.pagina.isClosed()) {
    if (existente.temporal && usuarioTemporalId !== undefined && existente.usuarioTemporalId !== usuarioTemporalId) throw new ErrorWhatsapp("NUMERO_NO_AUTORIZADO", "No tienes permiso para acceder a esa sesión temporal.", 403);
    const estado = await obtenerEstadoWhatsapp(numero);
    if (estado.estado !== "error") return estado;
    await cerrarWhatsapp(numero);
  }
  const pendiente = iniciando.get(numero);
  if (pendiente) {
    const estado = await pendiente;
    const iniciada = sesiones.get(numero);
    if (iniciada?.temporal && usuarioTemporalId !== undefined && iniciada.usuarioTemporalId !== usuarioTemporalId) throw new ErrorWhatsapp("NUMERO_NO_AUTORIZADO", "No tienes permiso para acceder a esa sesión temporal.", 403);
    return estado;
  }
  errores.delete(numero);
  const inicio = abrirSesion(numero, temporal, usuarioTemporalId);
  iniciando.set(numero, inicio);
  try { return await inicio; }
  finally { if (iniciando.get(numero) === inicio) iniciando.delete(numero); }
}
export async function obtenerEstadoWhatsapp(numeroEntrada: string): Promise<EstadoSesionWhatsapp> {
  const vinculacion = await obtenerLectura(numeroEntrada, false);
  return {
    numero: vinculacion.numero, iniciado: vinculacion.iniciado, conectado: vinculacion.conectado,
    qrVisible: vinculacion.qrVisible, paginaAbierta: vinculacion.paginaAbierta, temporal: vinculacion.temporal,
    estado: vinculacion.estado, mensaje: vinculacion.mensaje,
  };
}
export async function obtenerEstadosWhatsapp(numeros?: string[]): Promise<EstadoSesionWhatsapp[]> {
  return Promise.all((numeros ?? Array.from(sesiones.keys())).map(obtenerEstadoWhatsapp));
}
export async function cerrarWhatsapp(numeroEntrada: string): Promise<void> {
  const numero = validarNumero(numeroEntrada);
  const cierreAnterior = cerrando.get(numero);
  if (cierreAnterior) return cierreAnterior;
  const sesion = sesiones.get(numero);
  if (!sesion) return;
  const cierre = Promise.resolve().then(async () => {
    try { await sesion.contexto.close(); }
    finally { quitarSesion(sesion); await sesion.control.liberar(); }
  });
  cerrando.set(numero, cierre);
  try { await cierre; }
  finally { if (cerrando.get(numero) === cierre) cerrando.delete(numero); }
}
export async function cerrarYEliminarWhatsappTemporal(numeroEntrada: string): Promise<void> {
  const numero = validarNumero(numeroEntrada);
  if (iniciando.has(numero)) throw new ErrorWhatsapp("SESION_INICIANDO", "Espera a que termine de abrirse la sesión temporal.", 409);
  const sesion = sesiones.get(numero);
  if (!sesion?.temporal || sesion.usuarioTemporalId === null || path.dirname(sesion.carpeta) !== CARPETA_TEMPORALES) {
    throw new ErrorWhatsapp("SESION_NO_TEMPORAL", "No hay una sesión temporal propia que se pueda eliminar. Los perfiles permanentes se conservan.", 409);
  }
  if (cerrando.has(numero)) throw new ErrorWhatsapp("SESION_CERRANDO", "La sesión temporal ya se está cerrando.", 409);
  const limpieza = Promise.resolve().then(async () => {
    try {
      await sesion.contexto.close();
      quitarSesion(sesion);
      await sesion.control.liberar();
      await fs.promises.rm(sesion.carpeta, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
    } finally {
      quitarSesion(sesion);
      await sesion.control.liberar();
    }
  });
  cerrando.set(numero, limpieza);
  try { await limpieza; }
  finally { if (cerrando.get(numero) === limpieza) cerrando.delete(numero); }
}
export async function iniciarWhatsappParaEnvio(numeroEntrada: string, temporal = false, tiempoEsperaMs = 20_000): Promise<EstadoSesionWhatsapp> {
  let estado = await iniciarWhatsapp(numeroEntrada, temporal);
  const inicio = Date.now();
  while (!estado.conectado && !estado.qrVisible && Date.now() - inicio < tiempoEsperaMs) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    estado = await obtenerEstadoWhatsapp(numeroEntrada);
  }
  return estado;
}
export function obtenerPaginaWhatsapp(numeroEntrada: string): Page | null {
  const sesion = sesiones.get(normalizarNumero(numeroEntrada));
  return sesion && !sesion.pagina.isClosed() ? sesion.pagina : null;
}
export function existeSesionWhatsapp(numeroEntrada: string): boolean { return obtenerPaginaWhatsapp(numeroEntrada) !== null; }
export function esSesionWhatsappTemporal(numeroEntrada: string): boolean { return sesiones.get(normalizarNumero(numeroEntrada))?.temporal ?? false; }
export function obtenerUsuarioSesionTemporal(numeroEntrada: string): number | null { return sesiones.get(normalizarNumero(numeroEntrada))?.usuarioTemporalId ?? null; }
export function obtenerNumerosTemporalesUsuario(usuarioId: number): string[] {
  return Array.from(sesiones.values()).filter((sesion) => sesion.temporal && sesion.usuarioTemporalId === usuarioId).map((sesion) => sesion.numero);
}
export function normalizarNumeroWhatsapp(numero: string): string { return normalizarNumero(numero); }
export function esNumeroWhatsappValido(numero: string): boolean { return /^[+\d\s()-]+$/.test(numero) && /^9\d{8}$/.test(normalizarNumero(numero)); }

if (!registro.apagadoRegistrado) {
  registro.apagadoRegistrado = true;
  const cerrarSesiones = () => { void Promise.allSettled(Array.from(sesiones.keys()).map(cerrarWhatsapp)); };
  process.once("SIGTERM", cerrarSesiones);
  process.once("SIGINT", cerrarSesiones);
}
