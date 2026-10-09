// lib/whatsapp/whatsapp-session.ts
// Control de una conversación de WhatsApp Web mediante Playwright.

import { type Locator, type Page } from "playwright";
import { abrirSesionWhatsapp } from "./whatsapp-browser";

function limpiarNumero(numero: string): string {
  return numero.replace(/\D/g, "");
}

function normalizarNumeroPeru(numero: string): string {
  const limpio = limpiarNumero(numero);

  if (limpio.startsWith("51") && limpio.length === 11) {
    return limpio.slice(2);
  }

  return limpio;
}

async function buscarCompositor(page: Page): Promise<Locator> {
  const selectores = [
    '[data-testid="conversation-compose-box-input"]',
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][spellcheck="true"]',
  ];

  for (const selector of selectores) {
    const locator = page
      .locator(selector)
      .filter({
        visible: true,
      })
      .last();

    try {
      await locator.waitFor({
        state: "visible",
        timeout: 5000,
      });

      return locator;
    } catch {
      continue;
    }
  }

  await page.screenshot({
    path: "whatsapp-compositor-error.png",
    fullPage: false,
  });

  throw new Error(
    "No se encontró el campo de mensaje de WhatsApp Web. Se guardó whatsapp-compositor-error.png para revisar el DOM visual.",
  );
}

async function buscarBotonEnviar(page: Page): Promise<Locator> {
  const selectores = [
    '[data-testid="send"]',
    'button[aria-label*="Enviar"]',
    'button[aria-label*="Send"]',
    '[data-icon="send"]',
  ];

  for (const selector of selectores) {
    const locator = page
      .locator(selector)
      .filter({
        visible: true,
      })
      .last();

    try {
      await locator.waitFor({
        state: "visible",
        timeout: 3000,
      });

      return locator;
    } catch {
      continue;
    }
  }

  throw new Error("No se encontró el botón de enviar de WhatsApp Web.");
}

async function esperarConversacion(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");

  const limite = Date.now() + 30000;

  while (Date.now() < limite) {
    const composer = page
      .locator(
        [
          '[data-testid="conversation-compose-box-input"]',
          'footer div[contenteditable="true"]',
          'div[contenteditable="true"][data-tab="10"]',
          'div[contenteditable="true"][role="textbox"]',
          'div[role="textbox"][contenteditable="true"]',
        ].join(", "),
      )
      .filter({
        visible: true,
      });

    if ((await composer.count()) > 0) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error("WhatsApp Web no terminó de cargar la conversación.");
}

export async function enviarUnMensajeWhatsapp({
  numeroSalida,
  numeroDestino,
  mensaje,
}: {
  numeroSalida: string;
  numeroDestino: string;
  mensaje: string;
}) {
  const destino = normalizarNumeroPeru(numeroDestino);

  if (!/^9\d{8}$/.test(destino)) {
    throw new Error("El número de destino no es un celular peruano válido.");
  }

  if (!mensaje.trim()) {
    throw new Error("El mensaje está vacío.");
  }

  const sesion = await abrirSesionWhatsapp(numeroSalida);
  const page = sesion.page;

  if (!page.url().includes("web.whatsapp.com")) {
    await page.goto("https://web.whatsapp.com", {
      waitUntil: "domcontentloaded",
    });
  }

  const url = `https://web.whatsapp.com/send?phone=51${destino}`;

  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  await esperarConversacion(page);

  const compositor = await buscarCompositor(page);

  await compositor.click();
  await compositor.fill(mensaje);

  const botonEnviar = await buscarBotonEnviar(page);

  await botonEnviar.click();

  await page.waitForTimeout(1500);

  return {
    ok: true,
    numeroSalida: limpiarNumero(numeroSalida),
    numeroDestino: destino,
    mensaje,
  };
}
