import { type Page } from "playwright";
import {
  destinoCoincideConChatWhatsapp,
  evaluarConfirmacionEnvioWhatsapp,
  esperarConfirmacionWhatsapp,
  normalizarTextoMensajeWhatsapp,
  tiempoConfirmacionWhatsapp,
  type EstadoResultadoEnvioWhatsapp,
} from "./confirmacion-envio";
import {
  obtenerPaginaWhatsapp,
  obtenerEstadoWhatsapp,
  esNumeroWhatsappValido,
  normalizarNumeroWhatsapp,
} from "./playwright-local";

export type ResultadoEnvioWhatsapp = {
  ok: boolean;
  numeroSalida: string;
  telefonoDestino: string;
  mensaje: string;
  estado: EstadoResultadoEnvioWhatsapp;
  detalle: string;
  duracionMs: number;
};

type MensajeSaliente = {
  id: string;
  texto: string;
  indicadores: string[];
};

const INTERVALO_MINIMO_MS = 2_000;
const INTERVALO_MAXIMO_MS = 4_000;
const POLLING_CONFIRMACION_MS = 200;
const SELECTORES_MENSAJE_SALIENTE = [
  '[data-testid="msg-container"].message-out',
  '[data-testid="msg-container"] .message-out',
  "div.message-out",
];

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

function construirResultado(
  datos: Omit<ResultadoEnvioWhatsapp, "ok">,
): ResultadoEnvioWhatsapp {
  return { ...datos, ok: datos.estado === "ENVIADO" };
}

async function verificarWhatsappDisponible(pagina: Page): Promise<void> {
  if (!pagina.url().includes("web.whatsapp.com")) {
    throw new Error("La sesión no está ubicada en WhatsApp Web.");
  }

  try {
    await pagina.locator("body").waitFor({ state: "visible", timeout: 5_000 });
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
  if (!destinoCoincideConChatWhatsapp(pagina.url(), telefono)) {
    throw new Error("No se pudo verificar el teléfono abierto en WhatsApp Web.");
  }
}

async function esperarCajaMensaje(pagina: Page): Promise<void> {
  const selectores = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ];

  for (const selector of selectores) {
    try {
      const caja = pagina.locator(selector).last();
      await caja.waitFor({ state: "visible", timeout: 8_000 });
      if (await caja.isEditable()) return;
    } catch {}
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
      if (await caja.isVisible() && await caja.isEditable()) {
        await caja.click();
        await caja.fill(mensaje);
        return;
      }
    } catch {}
  }

  throw new Error("No se pudo escribir el mensaje.");
}

async function leerMensajesSalientes(pagina: Page): Promise<MensajeSaliente[]> {
  for (const selector of SELECTORES_MENSAJE_SALIENTE) {
    try {
      const mensajes = await pagina.locator(selector).evaluateAll((elementos) => {
        const nodos = [
          ...new Set(
            elementos.map(
              (elemento) =>
                elemento.closest('[data-testid="msg-container"]') ?? elemento,
            ),
          ),
        ];

        return nodos.map((elemento) => {
          const contenido =
            elemento.querySelector('[data-testid="selectable-text"]') ??
            elemento.querySelector(".selectable-text") ??
            elemento.querySelector(".copyable-text");
          const objetivoId =
            elemento.getAttribute("data-id") ??
            elemento.querySelector("[data-id]")?.getAttribute("data-id") ??
            "";
          const indicadores = [elemento, ...elemento.querySelectorAll("[data-icon], [aria-label]")]
            .flatMap((nodo) => [
              nodo.getAttribute("data-icon") ?? "",
              nodo.getAttribute("aria-label") ?? "",
            ])
            .filter(Boolean);

          return {
            id: objetivoId,
            texto: contenido?.textContent ?? "",
            indicadores,
          };
        });
      });

      if (mensajes.length) return mensajes;
    } catch {}
  }

  return [];
}

function clasificarIndicadores(indicadores: string[]): {
  confirmado: boolean;
  error: boolean;
} {
  const texto = indicadores.join(" ").toLowerCase();
  return {
    confirmado: /msg-check|msg-dblcheck|enviado|entregado|le[ií]do|sent|delivered|read/.test(
      texto,
    ),
    error: /msg-error|reintentar|volver a enviar|retry|failed|no se pudo enviar/.test(
      texto,
    ),
  };
}

async function esperarConfirmacionEnvio(
  pagina: Page,
  telefono: string,
  mensaje: string,
  cantidadAnterior: number,
  accionIniciada: boolean,
): Promise<{ estado: EstadoResultadoEnvioWhatsapp; detalle: string }> {
  const timeout = tiempoConfirmacionWhatsapp();
  const textoEsperado = normalizarTextoMensajeWhatsapp(mensaje);
  const estado = await esperarConfirmacionWhatsapp(async () => {
    const destinoCoincide = destinoCoincideConChatWhatsapp(
      pagina.url(),
      telefono,
    );
    const coincidencias = (await leerMensajesSalientes(pagina)).filter(
      (item) => normalizarTextoMensajeWhatsapp(item.texto) === textoEsperado,
    );
    const mensajeNuevoCoincide = coincidencias.length > cantidadAnterior;
    const mensajeNuevo = mensajeNuevoCoincide
      ? coincidencias[coincidencias.length - 1]
      : undefined;
    const indicadores = clasificarIndicadores(mensajeNuevo?.indicadores ?? []);
    return evaluarConfirmacionEnvioWhatsapp({
      destinoCoincide,
      mensajeNuevoCoincide,
      confirmacionVisible: indicadores.confirmado,
      errorVisible: indicadores.error,
      accionIniciada,
    });
  }, timeout, POLLING_CONFIRMACION_MS);

  if (estado === "ENVIADO")
    return {
      estado,
      detalle: "WhatsApp Web confirmó el mensaje nuevo en el chat de destino.",
    };

  if (estado === "ERROR")
    return {
      estado,
      detalle: "WhatsApp Web indicó que el mensaje no pudo enviarse.",
    };

  return {
    estado,
    detalle:
      "El mensaje pudo haberse enviado, pero WhatsApp Web no confirmó el resultado. No se reintentará automáticamente.",
  };
}

async function enviarMensaje(
  pagina: Page,
  alIniciarAccion: () => void,
): Promise<void> {
  let accionIniciada = false;
  const iniciarAccion = () => {
    accionIniciada = true;
    alIniciarAccion();
  };
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
        iniciarAccion();
        await boton.click();
        return;
      }
    } catch (error) {
      if (accionIniciada) throw error;
    }
  }

  const cajas = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ];

  for (const selector of cajas) {
    try {
      const caja = pagina.locator(selector).last();
      if (await caja.isVisible()) {
        iniciarAccion();
        await caja.press("Enter");
        return;
      }
    } catch (error) {
      if (accionIniciada) throw error;
    }
  }

  throw new Error("No se encontró el control de envío de WhatsApp.");
}

export async function enviarUnMensajeWhatsapp(
  numeroSalidaEntrada: string,
  telefonoDestinoEntrada: string,
  mensaje: string,
): Promise<ResultadoEnvioWhatsapp> {
  const inicio = Date.now();
  const numeroSalida = normalizarNumeroWhatsapp(numeroSalidaEntrada);
  const telefonoDestino = normalizarNumeroWhatsapp(telefonoDestinoEntrada);
  const mensajeLimpio = mensaje.trim();
  let accionIniciada = false;

  try {
    if (!esNumeroWhatsappValido(numeroSalida)) {
      throw new Error("El número de salida no es válido.");
    }
    if (!esNumeroWhatsappValido(telefonoDestino)) {
      throw new Error("El teléfono de destino no es válido.");
    }
    if (!mensajeLimpio) throw new Error("El mensaje no puede estar vacío.");

    const estadoWhatsapp = await obtenerEstadoWhatsapp(numeroSalida);
    if (!estadoWhatsapp.conectado) {
      throw new Error(
        `El número de salida ${numeroSalida} no está conectado a WhatsApp Web.`,
      );
    }

    const pagina = obtenerPaginaWhatsapp(numeroSalida);
    if (!pagina || pagina.isClosed()) {
      throw new Error(`No existe una sesión activa para ${numeroSalida}.`);
    }

    await abrirChat(pagina, telefonoDestino);
    await esperarCajaMensaje(pagina);
    await escribirMensaje(pagina, mensajeLimpio);
    await esperar(300);

    if (!destinoCoincideConChatWhatsapp(pagina.url(), telefonoDestino)) {
      throw new Error("El chat cambió antes de iniciar el envío.");
    }

    const textoEsperado = normalizarTextoMensajeWhatsapp(mensajeLimpio);
    const cantidadAnterior = (await leerMensajesSalientes(pagina)).filter(
      (item) => normalizarTextoMensajeWhatsapp(item.texto) === textoEsperado,
    ).length;

    await enviarMensaje(pagina, () => {
      accionIniciada = true;
    });

    const confirmacion = await esperarConfirmacionEnvio(
      pagina,
      telefonoDestino,
      mensajeLimpio,
      cantidadAnterior,
      accionIniciada,
    );

    if (confirmacion.estado === "ENVIADO") {
      await esperar(obtenerIntervaloAleatorio());
    }

    return construirResultado({
      numeroSalida,
      telefonoDestino,
      mensaje: mensajeLimpio,
      estado: confirmacion.estado,
      detalle: confirmacion.detalle,
      duracionMs: Date.now() - inicio,
    });
  } catch (error) {
    const estado = accionIniciada ? "INCIERTO" : "ERROR";
    return construirResultado({
      numeroSalida,
      telefonoDestino,
      mensaje: mensajeLimpio,
      estado,
      detalle:
        accionIniciada
          ? "La acción de envío pudo completarse, pero se interrumpió la confirmación. No se reintentará automáticamente."
          : error instanceof Error
            ? error.message
            : "Error antes de iniciar el envío.",
      duracionMs: Date.now() - inicio,
    });
  }
}
