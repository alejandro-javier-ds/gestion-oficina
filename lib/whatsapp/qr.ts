import type { Locator, Page } from "playwright";

const SELECTORES_CONECTADO = [
  "#pane-side",
  '[aria-label="Chat list"]',
  '[aria-label="Lista de chats"]',
  '[data-testid="chat-list"]',
];

const SELECTORES_QR = [
  "[data-ref] canvas",
  '[data-testid="qrcode"] canvas',
  'canvas[aria-label*="Scan this QR code"]',
  'canvas[aria-label*="Escanea este código QR"]',
  'canvas[aria-label*="Escanear código QR"]',
];

const RECARGAR_QR = /^(?:Click to reload QR code|Reload QR code|Haz clic para (?:volver a cargar|recargar) el código QR|Haga clic para (?:volver a cargar|recargar) el código QR|Recargar código QR)$/i;

export function esPaginaWhatsapp(url: string): boolean {
  try {
    return new URL(url).origin === "https://web.whatsapp.com";
  } catch {
    return false;
  }
}

async function estaConectado(pagina: Page): Promise<boolean> {
  for (const selector of SELECTORES_CONECTADO) {
    if (await pagina.locator(selector).first().isVisible()) return true;
  }
  return false;
}

async function localizarQr(pagina: Page): Promise<Locator | null> {
  for (const selector of SELECTORES_QR) {
    const canvas = pagina.locator(selector).first();
    if (await canvas.isVisible()) return canvas;
  }
  return null;
}

export async function leerVinculacionPagina(pagina: Page, incluirQr = false) {
  const vacio = { conectado: false, qrVisible: false, qr: null as string | null };
  if (pagina.isClosed() || !esPaginaWhatsapp(pagina.url())) return vacio;
  if (await estaConectado(pagina)) return { ...vacio, conectado: true };

  const recargar = pagina.getByText(RECARGAR_QR, { exact: true }).first();
  if (incluirQr && await recargar.isVisible()) {
    await recargar.click({ timeout: 1500 });
    if (await recargar.isVisible()) return vacio;
  }

  const canvas = await localizarQr(pagina);
  if (!canvas) return vacio;
  if (!incluirQr) return { ...vacio, qrVisible: true };

  const qr = await canvas.evaluate((elemento, selectores) => {
    if (location.origin !== "https://web.whatsapp.com" ||
      selectores.some((selector) => {
        const conectado = document.querySelector(selector);
        return conectado instanceof HTMLElement && conectado.getClientRects().length > 0;
      })) return null;
    if (!(elemento instanceof HTMLCanvasElement) || !elemento.isConnected ||
      elemento.getClientRects().length === 0 ||
      elemento.width < 128 || elemento.height < 128 ||
      elemento.width > 1024 || elemento.height > 1024) return null;
    return elemento.toDataURL("image/png");
  }, SELECTORES_CONECTADO, { timeout: 1500 });

  if (await estaConectado(pagina)) return { ...vacio, conectado: true };
  if (!qr || qr.length > 256_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(qr)) return vacio;
  return { conectado: false, qrVisible: true, qr };
}
