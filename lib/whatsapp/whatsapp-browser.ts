// lib/whatsapp/whatsapp-browser.ts
// Control centralizado de Chromium + WhatsApp Web.
// Mantiene una sesión persistente por perfil.
// No contiene lógica de campañas ni de selección de clientes.

import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

export type EstadoWhatsapp = "conectado" | "desconectado" | "iniciando";

export type SesionWhatsapp = {
  id: string;
  numero: string;
  estado: EstadoWhatsapp;
};

type SesionInterna = {
  id: string;
  numero: string;
  context: BrowserContext;
  page: Page;
};

const sesiones = new Map<string, SesionInterna>();

const NUMEROS_PRUEBA: Record<string, string> = {
  "950793296": "gestor-1",
};

const BASE_PERFILES = path.join(process.cwd(), ".whatsapp-sesiones");

function obtenerPerfil(numero: string): string | null {
  const limpio = numero.replace(/\D/g, "");

  return NUMEROS_PRUEBA[limpio] ?? null;
}

function obtenerDirectorio(perfil: string): string {
  const directorio = path.join(BASE_PERFILES, perfil);

  fs.mkdirSync(directorio, {
    recursive: true,
  });

  return directorio;
}

async function obtenerPagina(context: BrowserContext): Promise<Page> {
  const paginas = context.pages();

  if (paginas.length > 0) {
    return paginas[0];
  }

  return context.newPage();
}

async function paginaConectada(page: Page): Promise<boolean> {
  try {
    const url = page.url();

    if (!url.includes("web.whatsapp.com")) {
      return false;
    }

    return await page.evaluate(() => {
      const texto = document.body?.innerText?.toLowerCase() ?? "";

      const indicadores = [
        "chats",
        "buscar",
        "search",
        "archivados",
        "comunidades",
        "estados",
      ];

      return indicadores.some((indicador) => texto.includes(indicador));
    });
  } catch {
    return false;
  }
}

export async function abrirSesionWhatsapp(
  numero: string,
): Promise<SesionInterna> {
  const limpio = numero.replace(/\D/g, "");

  const perfil = obtenerPerfil(limpio);

  if (!perfil) {
    throw new Error(
      `No existe una sesión configurada para el número ${limpio}.`,
    );
  }

  const existente = sesiones.get(perfil);

  if (existente) {
    const conectada = await paginaConectada(existente.page);

    if (conectada) {
      return existente;
    }

    try {
      await existente.context.close();
    } catch { }

    sesiones.delete(perfil);
  }

  const context = await chromium.launchPersistentContext(
    obtenerDirectorio(perfil),
    {
      headless: false,
      viewport: {
        width: 1440,
        height: 900,
      },
      locale: "es-PE",
      timezoneId: "America/Lima",
    },
  );

  const page = await obtenerPagina(context);

  if (!page.url().includes("web.whatsapp.com")) {
    await page.goto("https://web.whatsapp.com", {
      waitUntil: "domcontentloaded",
    });
  }

  const sesion: SesionInterna = {
    id: perfil,
    numero: limpio,
    context,
    page,
  };

  sesiones.set(perfil, sesion);

  return sesion;
}

export async function obtenerEstadoSesiones(): Promise<SesionWhatsapp[]> {
  const resultado: SesionWhatsapp[] = [];

  for (const [perfil, sesion] of sesiones) {
    const conectada = await paginaConectada(sesion.page);

    resultado.push({
      id: perfil,
      numero: sesion.numero,
      estado: conectada ? "conectado" : "desconectado",
    });
  }

  return resultado;
}

export function obtenerPerfilNumero(numero: string): string | null {
  return obtenerPerfil(numero.replace(/\D/g, ""));
}

export async function cerrarSesionWhatsapp(numero: string): Promise<void> {
  const limpio = numero.replace(/\D/g, "");

  const perfil = obtenerPerfil(limpio);

  if (!perfil) {
    throw new Error(`No existe una sesión configurada para ${limpio}.`);
  }

  const sesion = sesiones.get(perfil);

  if (!sesion) {
    return;
  }

  await sesion.context.close();

  sesiones.delete(perfil);
}
