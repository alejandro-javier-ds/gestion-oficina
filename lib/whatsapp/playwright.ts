// lib/whatsapp/playwright.ts
//
// Gestión de sesiones independientes de WhatsApp Web.
//
// Estados:
//
// - conectado
// - no_vinculado
// - desconectado
// - conectando
// - error
//
// Tipos de sesión:
//
// - permanente: queda disponible para futuras campañas.
// - temporal: solo para una campaña/uso temporal.

import { chromium, type BrowserContext, type Page } from "playwright";

import fs from "node:fs";
import path from "node:path";

const CARPETA_SESIONES = path.join(process.cwd(), "whatsapp-sessions");

const URL_WHATSAPP = "https://web.whatsapp.com/";

export type EstadoConexionWhatsapp =
  | "conectado"
  | "no_vinculado"
  | "desconectado"
  | "conectando"
  | "error";

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
};

const sesiones = new Map<string, SesionWhatsappInterna>();

const iniciando = new Set<string>();

function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, "").replace(/^51/, "").slice(0, 9);
}

function esNumeroValido(numero: string): boolean {
  return /^9\d{8}$/.test(numero);
}

function asegurarCarpetaSesiones() {
  if (!fs.existsSync(CARPETA_SESIONES)) {
    fs.mkdirSync(CARPETA_SESIONES, {
      recursive: true,
    });
  }
}

async function esperarPaginaViva(
  pagina: Page,
  duracionMs: number,
  intervaloMs = 100,
): Promise<boolean> {
  const inicio = Date.now();

  while (Date.now() - inicio < duracionMs) {
    if (pagina.isClosed()) {
      return false;
    }

    const restante = duracionMs - (Date.now() - inicio);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(intervaloMs, Math.max(restante, 0)));
    });
  }

  return !pagina.isClosed();
}

function esCierreDeTarget(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const mensaje = error.message.toLowerCase();

  return (
    mensaje.includes("target page, context or browser has been closed") ||
    mensaje.includes("page has been closed") ||
    mensaje.includes("browser has been closed") ||
    mensaje.includes("context has been closed")
  );
}

function obtenerCarpetaSesion(numero: string): string {
  return path.join(CARPETA_SESIONES, numero);
}

function existePerfilSesion(numero: string): boolean {
  const carpeta = obtenerCarpetaSesion(numero);

  if (!fs.existsSync(carpeta)) {
    return false;
  }

  try {
    return fs.readdirSync(carpeta).length > 0;
  } catch {
    return false;
  }
}

function obtenerPaginaActiva(paginas: Page[]): Page | null {
  if (paginas.length === 0) {
    return null;
  }

  return (
    paginas.find((pagina) => pagina.url().includes("web.whatsapp.com")) ??
    paginas[0]
  );
}

async function detectarConexion(pagina: Page): Promise<{
  conectado: boolean;
  qrVisible: boolean;
}> {
  const url = pagina.url();

  if (!url.includes("web.whatsapp.com")) {
    return {
      conectado: false,
      qrVisible: false,
    };
  }

  const selectoresQr = [
    "canvas",
    "[data-ref]",
    '[aria-label*="QR"]',
    '[aria-label*="Código QR"]',
  ];

  for (const selector of selectoresQr) {
    try {
      if (
        await pagina.locator(selector).first().isVisible({
          timeout: 800,
        })
      ) {
        return {
          conectado: false,
          qrVisible: true,
        };
      }
    } catch { }
  }

  const selectoresConectado = [
    "#pane-side",
    '[aria-label="Chat list"]',
    '[data-testid="chat-list"]',
  ];

  for (const selector of selectoresConectado) {
    try {
      if (
        await pagina.locator(selector).first().isVisible({
          timeout: 800,
        })
      ) {
        return {
          conectado: true,
          qrVisible: false,
        };
      }
    } catch { }
  }

  return {
    conectado: false,
    qrVisible: false,
  };
}

function construirEstadoSinSesion(numero: string): EstadoSesionWhatsapp {
  const tienePerfil = existePerfilSesion(numero);

  return {
    numero,

    iniciado: false,

    conectado: false,

    qrVisible: false,

    paginaAbierta: false,

    temporal: false,

    estado: tienePerfil ? "desconectado" : "no_vinculado",

    mensaje: tienePerfil
      ? "Existe una sesión guardada, pero WhatsApp Web no está conectado."
      : "Este número todavía no está vinculado a WhatsApp Web.",
  };
}

async function construirEstado(
  sesion: SesionWhatsappInterna | null,
  numero: string,
): Promise<EstadoSesionWhatsapp> {
  if (!sesion || sesion.pagina.isClosed()) {
    return construirEstadoSinSesion(numero);
  }

  try {
    const conexion = await detectarConexion(sesion.pagina);

    if (conexion.conectado) {
      return {
        numero,

        iniciado: true,

        conectado: true,

        qrVisible: false,

        paginaAbierta: true,

        temporal: sesion.temporal,

        estado: "conectado",

        mensaje: sesion.temporal
          ? "WhatsApp Web conectado. Esta es una sesión temporal."
          : "WhatsApp Web conectado y listo para utilizarse.",
      };
    }

    if (conexion.qrVisible) {
      return {
        numero,

        iniciado: true,

        conectado: false,

        qrVisible: true,

        paginaAbierta: true,

        temporal: sesion.temporal,

        estado: "conectando",

        mensaje: "WhatsApp Web está esperando el escaneo del código QR.",
      };
    }

    return {
      numero,

      iniciado: true,

      conectado: false,

      qrVisible: false,

      paginaAbierta: true,

      temporal: sesion.temporal,

      estado: "conectando",

      mensaje: "WhatsApp Web está iniciándose.",
    };
  } catch {
    return {
      numero,

      iniciado: true,

      conectado: false,

      qrVisible: false,

      paginaAbierta: !sesion.pagina.isClosed(),

      temporal: sesion.temporal,

      estado: "error",

      mensaje: "No se pudo comprobar el estado de WhatsApp Web.",
    };
  }
}

function registrarEventosSesion(sesion: SesionWhatsappInterna) {
  sesion.contexto.on("close", () => {
    sesiones.delete(sesion.numero);
  });

  sesion.pagina.on("close", () => {
    const actual = sesiones.get(sesion.numero);

    if (actual?.pagina === sesion.pagina) {
      sesiones.delete(sesion.numero);
    }
  });
}

async function eliminarCarpetaConReintentos(
  carpeta: string,
  intentos = 8,
  esperaMs = 500,
): Promise<void> {
  if (!fs.existsSync(carpeta)) {
    return;
  }

  let ultimoError: unknown = undefined;

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      await fs.promises.rm(carpeta, {
        recursive: true,

        force: true,
      });

      return;
    } catch (error) {
      ultimoError = error;

      const codigo = (
        error as {
          code?: string;
        }
      )?.code;

      const esBloqueo =
        codigo === "EBUSY" || codigo === "EPERM" || codigo === "ENOTEMPTY";

      if (!esBloqueo || intento === intentos) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, esperaMs));
    }
  }

  if (ultimoError) {
    throw ultimoError;
  }
}

export async function iniciarWhatsapp(
  numeroEntrada: string,
  temporal = false,
): Promise<EstadoSesionWhatsapp> {
  const numero = normalizarNumero(numeroEntrada);

  if (!esNumeroValido(numero)) {
    throw new Error(
      "El número de WhatsApp debe ser un celular peruano válido de 9 dígitos.",
    );
  }

  const sesionExistente = sesiones.get(numero);

  if (sesionExistente && !sesionExistente.pagina.isClosed()) {
    return construirEstado(sesionExistente, numero);
  }

  if (iniciando.has(numero)) {
    return {
      numero,

      iniciado: false,

      conectado: false,

      qrVisible: false,

      paginaAbierta: false,

      temporal,

      estado: "conectando",

      mensaje: "La sesión de este número ya se está iniciando.",
    };
  }

  iniciando.add(numero);

  try {
    asegurarCarpetaSesiones();

    const carpetaSesion = obtenerCarpetaSesion(numero);

    if (!fs.existsSync(carpetaSesion)) {
      fs.mkdirSync(carpetaSesion, {
        recursive: true,
      });
    }

    const contexto = await chromium.launchPersistentContext(carpetaSesion, {
      headless: false,

      viewport: {
        width: 1440,

        height: 900,
      },

      locale: "es-PE",

      timezoneId: "America/Lima",

      args: [
        "--start-maximized",

        "--disable-blink-features=AutomationControlled",
      ],
    });

    let pagina = obtenerPaginaActiva(contexto.pages());

    if (!pagina) {
      pagina = await contexto.newPage();
    }

    const nuevaSesion: SesionWhatsappInterna = {
      numero,

      contexto,

      pagina,

      temporal,
    };

    sesiones.set(numero, nuevaSesion);

    registrarEventosSesion(nuevaSesion);

    try {
      if (pagina.isClosed()) {
        sesiones.delete(numero);
        return construirEstadoSinSesion(numero);
      }

      if (!pagina.url().includes("web.whatsapp.com")) {
        await pagina.goto(URL_WHATSAPP, {
          waitUntil: "domcontentloaded",

          timeout: 60_000,
        });
      }

      const paginaSigueViva = await esperarPaginaViva(pagina, 5_000);

      if (!paginaSigueViva) {
        const actual = sesiones.get(numero);

        if (actual?.pagina === pagina) {
          sesiones.delete(numero);
        }

        return construirEstadoSinSesion(numero);
      }

      return construirEstado(nuevaSesion, numero);
    } catch (error) {
      if (pagina.isClosed() || esCierreDeTarget(error)) {
        const actual = sesiones.get(numero);

        if (actual?.pagina === pagina) {
          sesiones.delete(numero);
        }

        try {
          await contexto.close();
        } catch { }

        return construirEstadoSinSesion(numero);
      }

      throw error;
    }
  } catch (error) {
    const sesion = sesiones.get(numero);

    if (sesion) {
      try {
        await sesion.contexto.close();
      } catch { }

      sesiones.delete(numero);
    }

    if (esCierreDeTarget(error)) {
      return construirEstadoSinSesion(numero);
    }

    throw error;
  } finally {
    iniciando.delete(numero);
  }
}

export async function obtenerEstadoWhatsapp(
  numeroEntrada: string,
): Promise<EstadoSesionWhatsapp> {
  const numero = normalizarNumero(numeroEntrada);

  if (!esNumeroValido(numero)) {
    throw new Error("El número de WhatsApp no es válido.");
  }

  const sesion = sesiones.get(numero) ?? null;

  return construirEstado(sesion, numero);
}

export async function obtenerEstadosWhatsapp(
  numeros?: string[],
): Promise<EstadoSesionWhatsapp[]> {
  const lista = numeros ?? Array.from(sesiones.keys());

  const resultados: EstadoSesionWhatsapp[] = [];

  for (const numero of lista) {
    resultados.push(await obtenerEstadoWhatsapp(numero));
  }

  return resultados;
}

export async function cerrarWhatsapp(numeroEntrada: string): Promise<void> {
  const numero = normalizarNumero(numeroEntrada);

  if (!esNumeroValido(numero)) {
    throw new Error("El número de WhatsApp no es válido.");
  }

  const sesion = sesiones.get(numero);

  if (!sesion) {
    return;
  }

  try {
    await sesion.contexto.close();
  } finally {
    sesiones.delete(numero);
  }
}

export async function cerrarYEliminarWhatsappTemporal(
  numeroEntrada: string,
): Promise<void> {
  const numero = normalizarNumero(numeroEntrada);

  if (!esNumeroValido(numero)) {
    throw new Error("El número de WhatsApp no es válido.");
  }

  const sesion = sesiones.get(numero);

  if (sesion && !sesion.temporal) {
    throw new Error(
      "La sesión indicada es permanente y no puede eliminarse como temporal.",
    );
  }

  if (sesion) {
    try {
      await sesion.contexto.close();
    } finally {
      sesiones.delete(numero);
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  const carpetaSesion = obtenerCarpetaSesion(numero);

  await eliminarCarpetaConReintentos(carpetaSesion);
}

export async function iniciarWhatsappParaEnvio(
  numeroEntrada: string,
  temporal = false,
  tiempoEsperaMs = 20_000,
): Promise<EstadoSesionWhatsapp> {
  let estado = await iniciarWhatsapp(numeroEntrada, temporal);

  if (estado.conectado) {
    return estado;
  }

  const inicio = Date.now();

  while (Date.now() - inicio < tiempoEsperaMs) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    estado = await obtenerEstadoWhatsapp(numeroEntrada);

    if (estado.conectado) {
      return estado;
    }

    if (estado.qrVisible) {
      return estado;
    }
  }

  return estado;
}

export function obtenerPaginaWhatsapp(numeroEntrada: string): Page | null {
  const numero = normalizarNumero(numeroEntrada);

  const sesion = sesiones.get(numero);

  if (!sesion || sesion.pagina.isClosed()) {
    return null;
  }

  return sesion.pagina;
}

export function existeSesionWhatsapp(numeroEntrada: string): boolean {
  const numero = normalizarNumero(numeroEntrada);

  const sesion = sesiones.get(numero);

  return Boolean(sesion && !sesion.pagina.isClosed());
}

export function esSesionWhatsappTemporal(numeroEntrada: string): boolean {
  const numero = normalizarNumero(numeroEntrada);

  return sesiones.get(numero)?.temporal ?? false;
}

export function normalizarNumeroWhatsapp(numero: string): string {
  return normalizarNumero(numero);
}

export function esNumeroWhatsappValido(numero: string): boolean {
  return esNumeroValido(normalizarNumero(numero));
}
