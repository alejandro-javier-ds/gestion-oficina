// lib/whatsapp/envio.ts
//
// Servicio REAL de envío de WhatsApp.
//
// El motor de campaña se encarga de:
// - reintentos
// - reanudación
// - múltiples campañas
// - estados de BD

import { type Page } from "playwright";

import {
  obtenerPaginaWhatsapp,
  obtenerEstadoWhatsapp,
  esNumeroWhatsappValido,
  normalizarNumeroWhatsapp,
} from "./playwright";

export type ResultadoEnvioWhatsapp = {
  ok: boolean;
  numeroSalida: string;
  telefonoDestino: string;
  mensaje: string;
  estado: "ENVIADO" | "ERROR";
  detalle: string;
  duracionMs: number;
};

const INTERVALO_MINIMO_MS = 2_000;

const INTERVALO_MAXIMO_MS = 4_000;

const TIMEOUT_CONFIRMACION_MS = 4_000;

const POLLING_CONFIRMACION_MS = 150;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function obtenerIntervaloAleatorio(): number {
  return (
    Math.floor(
      Math.random() * (INTERVALO_MAXIMO_MS - INTERVALO_MINIMO_MS + 1),
    ) + INTERVALO_MINIMO_MS
  );
}

function construirUrlChat(telefono: string): string {
  return `https://web.whatsapp.com/send?phone=51${telefono}`;
}

async function verificarWhatsappDisponible(pagina: Page): Promise<void> {
  const url = pagina.url();

  if (!url.includes("web.whatsapp.com")) {
    throw new Error("La sesión no está ubicada en WhatsApp Web.");
  }

  try {
    await pagina.locator("body").waitFor({
      state: "visible",
      timeout: 5_000,
    });
  } catch {
    throw new Error("La interfaz de WhatsApp Web no está disponible.");
  }
}

async function abrirChat(pagina: Page, telefono: string): Promise<void> {
  await verificarWhatsappDisponible(pagina);

  await pagina.goto(construirUrlChat(telefono), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await esperar(1_000);
}

async function esperarCajaMensaje(pagina: Page): Promise<void> {
  const selectores = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ];

  for (const selector of selectores) {
    try {
      const caja = pagina.locator(selector).last();

      await caja.waitFor({
        state: "visible",
        timeout: 8_000,
      });

      if (await caja.isEditable()) {
        return;
      }
    } catch { }
  }

  throw new Error("No se encontró la caja de mensaje de WhatsApp.");
}

async function escribirMensaje(pagina: Page, mensaje: string): Promise<void> {
  const selectores = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ];

  for (const selector of selectores) {
    try {
      const caja = pagina.locator(selector).last();

      if ((await caja.isVisible()) && (await caja.isEditable())) {
        await caja.click();

        await caja.fill(mensaje);

        return;
      }
    } catch { }
  }

  throw new Error("No se pudo escribir el mensaje.");
}

async function contarMensajesSalientes(pagina: Page): Promise<number> {
  const selectores = [
    '[data-testid="msg-container"].message-out',
    '[data-testid="msg-container"] .message-out',
    "div.message-out",
  ];

  let mayorCantidad = 0;

  for (const selector of selectores) {
    try {
      const cantidad = await pagina.locator(selector).count();

      if (cantidad > mayorCantidad) {
        mayorCantidad = cantidad;
      }
    } catch { }
  }

  return mayorCantidad;
}

function obtenerUltimoMensajeSaliente(pagina: Page) {
  const selectores = [
    '[data-testid="msg-container"].message-out',
    '[data-testid="msg-container"] .message-out',
    "div.message-out",
  ];

  for (const selector of selectores) {
    const locator = pagina.locator(selector);

    if (locator) {
      return locator.last();
    }
  }

  return null;
}

async function esperarConfirmacionEnvio(
  pagina: Page,
  cantidadAntes: number,
): Promise<void> {
  const inicio = Date.now();

  while (Date.now() - inicio < TIMEOUT_CONFIRMACION_MS) {
    const cantidadActual = await contarMensajesSalientes(pagina);

    if (cantidadActual > cantidadAntes) {
      const ultimo = obtenerUltimoMensajeSaliente(pagina);

      if (ultimo) {
        const selectoresError = [
          '[data-icon="msg-error"]',
          '[data-icon="error"]',
          '[aria-label*="Reintentar"]',
          '[aria-label*="reintentar"]',
          '[aria-label*="Volver a enviar"]',
          '[aria-label*="volver a enviar"]',
          '[aria-label*="Retry"]',
          '[aria-label*="retry"]',
        ];

        for (const selector of selectoresError) {
          try {
            const errorLocator = ultimo.locator(selector);

            if ((await errorLocator.count()) > 0) {
              const visible = errorLocator.last();

              if (await visible.isVisible()) {
                throw new Error(
                  "WhatsApp Web indicó que el mensaje no pudo enviarse.",
                );
              }
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("WhatsApp Web indicó")
            ) {
              throw error;
            }
          }
        }

        const selectoresExito = [
          '[data-icon="msg-check"]',
          '[data-icon="msg-dblcheck"]',
          '[aria-label*="Enviado"]',
          '[aria-label*="enviado"]',
          '[aria-label*="Sent"]',
          '[aria-label*="sent"]',
        ];

        for (const selector of selectoresExito) {
          try {
            const checkLocator = ultimo.locator(selector);

            if ((await checkLocator.count()) > 0) {
              const check = checkLocator.last();

              if (await check.isVisible()) {
                return;
              }
            }
          } catch { }
        }

        await esperar(250);

        for (const selector of selectoresExito) {
          try {
            const checkLocator = ultimo.locator(selector);

            if ((await checkLocator.count()) > 0) {
              const check = checkLocator.last();

              if (await check.isVisible()) {
                return;
              }
            }
          } catch { }
        }
      }
    }

    await esperar(POLLING_CONFIRMACION_MS);
  }

  throw new Error(
    "WhatsApp Web no confirmó el envío del mensaje dentro del tiempo esperado.",
  );
}

async function enviarMensaje(pagina: Page): Promise<void> {
  const selectoresBoton = [
    'button[aria-label="Enviar"]',
    'button[aria-label*="Enviar"]',
    '[data-testid="send"]',
    '[data-icon="send"]',
  ];

  for (const selector of selectoresBoton) {
    try {
      const boton = pagina.locator(selector).last();

      if (await boton.isVisible()) {
        await boton.click();

        return;
      }
    } catch { }
  }

  const cajas = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ];

  for (const selector of cajas) {
    try {
      const caja = pagina.locator(selector).last();

      if (await caja.isVisible()) {
        await caja.press("Enter");

        return;
      }
    } catch { }
  }

  throw new Error("No se encontró el control de envío de WhatsApp.");
}

async function esperarEntreMensajes(): Promise<void> {
  const intervalo = obtenerIntervaloAleatorio();

  await esperar(intervalo);
}

export async function enviarUnMensajeWhatsapp(
  numeroSalidaEntrada: string,
  telefonoDestinoEntrada: string,
  mensaje: string,
): Promise<ResultadoEnvioWhatsapp> {
  const inicio = Date.now();

  const numeroSalida = normalizarNumeroWhatsapp(numeroSalidaEntrada);

  const telefonoDestino = normalizarNumeroWhatsapp(telefonoDestinoEntrada);

  if (!esNumeroWhatsappValido(numeroSalida)) {
    throw new Error("El número de salida no es válido.");
  }

  if (!esNumeroWhatsappValido(telefonoDestino)) {
    throw new Error("El teléfono de destino no es válido.");
  }

  const mensajeLimpio = mensaje.trim();

  if (!mensajeLimpio) {
    throw new Error("El mensaje no puede estar vacío.");
  }

  const estado = await obtenerEstadoWhatsapp(numeroSalida);

  if (!estado.conectado) {
    throw new Error(
      `El número de salida ${numeroSalida} no está conectado a WhatsApp Web.`,
    );
  }

  const pagina = obtenerPaginaWhatsapp(numeroSalida);

  if (!pagina || pagina.isClosed()) {
    throw new Error(`No existe una sesión activa para ${numeroSalida}.`);
  }

  try {
    await abrirChat(pagina, telefonoDestino);

    await esperarCajaMensaje(pagina);

    const cantidadMensajesAntes = await contarMensajesSalientes(pagina);

    await escribirMensaje(pagina, mensajeLimpio);

    await esperar(300);

    await enviarMensaje(pagina);

    await esperarConfirmacionEnvio(pagina, cantidadMensajesAntes);

    const duracionMs = Date.now() - inicio;

    await esperarEntreMensajes();

    return {
      ok: true,

      numeroSalida,

      telefonoDestino,

      mensaje: mensajeLimpio,

      estado: "ENVIADO",

      detalle: "WhatsApp Web confirmó el nuevo mensaje saliente.",

      duracionMs,
    };
  } catch (error) {
    const duracionMs = Date.now() - inicio;

    return {
      ok: false,

      numeroSalida,

      telefonoDestino,

      mensaje: mensajeLimpio,

      estado: "ERROR",

      detalle:
        error instanceof Error
          ? error.message
          : "Error desconocido durante el envío.",

      duracionMs,
    };
  }
}
