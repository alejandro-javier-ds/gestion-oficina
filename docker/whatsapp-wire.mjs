import fs from "node:fs";
import https from "node:https";
import { createHash, createPrivateKey, randomUUID, sign, verify, X509Certificate } from "node:crypto";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import { WebSocket } from "ws";

export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const OPERACIONES = new Set(["iniciar", "estado", "qr", "metadatos", "temporales", "cerrarTemporal", "enviar", "visor", "campana"]);
export const CABECERAS_PRIVADAS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export class ErrorRemotoWhatsapp extends Error {
  constructor(codigo, mensaje, status = 503) { super(mensaje); this.codigo = codigo; this.status = status; }
}

export function modoWhatsapp() {
  const modo = process.env.WHATSAPP_BACKEND ?? "local";
  if (modo !== "local" && modo !== "remote") throw new ErrorRemotoWhatsapp("CONFIGURACION_WHATSAPP", "WHATSAPP_BACKEND debe ser local o remote.");
  return modo;
}

export function validarActor(actor, op) {
  if (!actor || !Number.isSafeInteger(actor.userId) || actor.userId < 1 || actor.debeCambiarContrasena !== false ||
    !(op === "estado" ? ["administrador", "supervisor", "gestor"] : ["administrador", "supervisor"]).includes(actor.rol) ||
    actor.campanaLeaseId !== undefined && !UUID.test(actor.campanaLeaseId)) {
    throw new ErrorRemotoWhatsapp("OPERACION_NO_AUTORIZADA", "No tienes permiso para realizar esta operación de WhatsApp.", 403);
  }
}

export function validarOperacion(entrada) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada) || !OPERACIONES.has(entrada.op) ||
    Object.keys(entrada).some((k) => !["op", "numero", "payload"].includes(k))) throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  if (!["temporales", "campana"].includes(entrada.op) && !/^9\d{8}$/.test(entrada.numero ?? "")) throw new ErrorRemotoWhatsapp("NUMERO_INVALIDO", "Número inválido.", 400);
  const payload = entrada.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  const claves = { iniciar: ["temporal"], enviar: ["destino", "mensaje", "idEnvio", "leaseId"], visor: ["id"], campana: ["accion", "campanaId", "leaseId"] }[entrada.op] ?? [];
  if (Object.keys(payload).some((k) => !claves.includes(k))) throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  if (entrada.op !== "campana" && (entrada.op === "enviar" ? ["destino", "mensaje", "idEnvio"] : claves).some((k) => !(k in payload))) throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  if (entrada.op === "iniciar" && typeof payload.temporal !== "boolean") throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  if (entrada.op === "visor" && !UUID.test(payload.id ?? "")) throw new ErrorRemotoWhatsapp("VISOR_INVALIDO", "Visor inválido.", 400);
  if (entrada.op === "campana" && (!Number.isSafeInteger(payload.campanaId) || payload.campanaId < 1 || !["iniciar", "finalizar"].includes(payload.accion) ||
    payload.accion === "iniciar" && "leaseId" in payload || payload.accion === "finalizar" && !UUID.test(payload.leaseId ?? ""))) throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  if (entrada.op === "enviar" && (!/^9\d{8}$/.test(payload.destino ?? "") || !UUID.test(payload.idEnvio ?? "") || "leaseId" in payload && !UUID.test(payload.leaseId ?? "") ||
    typeof payload.mensaje !== "string" || !payload.mensaje.trim() || payload.mensaje.length > 16_000)) {
    throw new ErrorRemotoWhatsapp("ENVIO_INVALIDO", "El teléfono, mensaje o identificador de envío no es válido.", 400);
  }
  return entrada;
}

export function firmarOperacion(entrada, actor, key, ahora = Date.now()) {
  validarOperacion(entrada);
  validarActor(actor, entrada.op);
  const cuerpo = JSON.stringify(entrada);
  const capacidad = Buffer.from(JSON.stringify({ v: 1, op: entrada.op, numero: entrada.numero ?? null,
    userId: actor.userId, rol: actor.rol, iat: Math.floor(ahora / 1000), exp: Math.floor(ahora / 1000) + 30,
    campanaLeaseId: actor.campanaLeaseId ?? null, nonce: randomUUID(), hash: createHash("sha256").update(cuerpo).digest("hex") })).toString("base64url");
  return { cuerpo, headers: { "Content-Type": "application/json", "x-crm-capacidad": capacidad,
    "x-crm-firma": sign("sha256", Buffer.from(capacidad), key).toString("base64url") } };
}

export function verificarOperacion(cuerpo, headers, certificado, nonces, ahora = Date.now()) {
  const capacidad = headers["x-crm-capacidad"];
  const firma = headers["x-crm-firma"];
  const fallo = () => { throw new ErrorRemotoWhatsapp("CAPACIDAD_INVALIDA", "Autorización inválida.", 403); };
  if (typeof capacidad !== "string" || typeof firma !== "string" || capacidad.length > 2048 || firma.length > 2048 ||
    !/^[\w-]+$/.test(capacidad) || !/^[\w-]+$/.test(firma)) fallo();
  if (!verify("sha256", Buffer.from(capacidad), certificado.publicKey, Buffer.from(firma, "base64url"))) fallo();
  let datos;
  try { datos = JSON.parse(Buffer.from(capacidad, "base64url").toString()); } catch { fallo(); }
  const segundos = Math.floor(ahora / 1000);
  if (datos?.v !== 1 || !Number.isSafeInteger(datos.iat) || !Number.isSafeInteger(datos.exp) || datos.iat > segundos + 5 ||
    datos.exp < segundos || datos.exp - datos.iat !== 30 || segundos - datos.iat > 35 || !UUID.test(datos.nonce ?? "") ||
    datos.hash !== createHash("sha256").update(cuerpo).digest("hex")) fallo();
  let entrada;
  try { entrada = validarOperacion(JSON.parse(cuerpo)); } catch { fallo(); }
  if (entrada.op !== datos.op || (entrada.numero ?? null) !== datos.numero) fallo();
  if (datos?.campanaLeaseId != null && !UUID.test(datos.campanaLeaseId)) fallo();
  const actor = { userId: datos.userId, rol: datos.rol, debeCambiarContrasena: false,
    ...(datos.campanaLeaseId ? { campanaLeaseId: datos.campanaLeaseId } : {}) };
  validarActor(actor, entrada.op);
  for (const [nonce, caduca] of nonces) if (caduca < segundos - 5) nonces.delete(nonce);
  if (nonces.has(datos.nonce) || nonces.size >= 10_000) fallo();
  nonces.set(datos.nonce, datos.exp);
  return { entrada, actor };
}

function leerConfiguracion(env) {
  const url = new URL(env.WHATSAPP_SERVICE_URL ?? "https://10.0.2.68:8443");
  const partes = url.hostname.split(".").map(Number);
  const privada = isIP(url.hostname) === 4 && (partes[0] === 10 || partes[0] === 192 && partes[1] === 168 || partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    (!privada && !(env.NODE_ENV === "test" && url.hostname === "127.0.0.1"))) throw new Error("WHATSAPP_SERVICE_URL requiere HTTPS y una IP privada.");
  const ca = fs.readFileSync(env.WHATSAPP_SERVICE_CA_FILE ?? "");
  const cert = fs.readFileSync(env.WHATSAPP_SERVICE_CERT_FILE ?? "");
  const keyPem = fs.readFileSync(env.WHATSAPP_SERVICE_KEY_FILE ?? "");
  const key = createPrivateKey(keyPem);
  const x509 = new X509Certificate(cert);
  if (!x509.checkPrivateKey(key) || key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
    Date.now() < Date.parse(x509.validFrom) || Date.now() >= Date.parse(x509.validTo)) throw new Error("Certificado cliente inválido.");
  const tls = { ca, cert, key: keyPem, minVersion: "TLSv1.3", rejectUnauthorized: true };
  return { url, key, tls, certificado: x509, agente: new https.Agent({ ...tls, keepAlive: true, maxCachedSessions: 0, maxSockets: 16, maxFreeSockets: 4 }) };
}

export function crearClienteWhatsapp(env = process.env) {
  let config;
  try { config = leerConfiguracion(env); }
  catch { throw new ErrorRemotoWhatsapp("CONFIGURACION_WHATSAPP", "No se pudo validar la URL privada o los certificados del servicio de WhatsApp."); }
  return {
    async operar(entrada, actor, timeout = 90_000) {
      if (Date.now() < Date.parse(config.certificado.validFrom) || Date.now() >= Date.parse(config.certificado.validTo)) {
        throw new ErrorRemotoWhatsapp("CERTIFICADO_WHATSAPP", "El certificado cliente requiere renovación.");
      }
      const firmado = firmarOperacion(entrada, actor, config.key);
      return new Promise((resolve, reject) => {
        const request = https.request(new URL("/v1/operacion", config.url), { method: "POST", agent: config.agente,
          headers: { ...firmado.headers, "Content-Length": Buffer.byteLength(firmado.cuerpo) } }, (response) => {
          let longitud = 0;
          const partes = [];
          response.on("data", (datos) => { longitud += datos.length; if (longitud > 3_000_000) request.destroy(); else partes.push(datos); });
          response.once("error", () => request.destroy());
          response.once("end", () => {
            clearTimeout(corte);
            try {
              const datos = JSON.parse(Buffer.concat(partes).toString());
              if (response.statusCode !== 200) reject(new ErrorRemotoWhatsapp(datos.codigo ?? "SERVICIO_WHATSAPP", datos.error ?? "La VM de WhatsApp no está disponible.", response.statusCode ?? 503));
              else resolve(datos.resultado);
            } catch { reject(new ErrorRemotoWhatsapp("RESPUESTA_WHATSAPP", "La VM de WhatsApp devolvió una respuesta inválida.")); }
          });
        });
        const corte = setTimeout(() => request.destroy(), timeout);
        request.once("socket", (socket) => {
          const comprobar = () => {
            const peer = socket.getPeerCertificate();
            if (!socket.authorized || checkServerIdentity(config.url.hostname, peer) ||
              !Number.isFinite(Date.parse(peer.valid_to)) || Date.now() >= Date.parse(peer.valid_to) || Date.now() < Date.parse(peer.valid_from)) request.destroy();
          };
          if (request.reusedSocket) comprobar();
          else socket.once("secureConnect", comprobar);
        });
        request.once("error", () => { clearTimeout(corte); reject(new ErrorRemotoWhatsapp("SERVICIO_WHATSAPP", "No se pudo conectar de forma segura con la VM de WhatsApp. No se inició Chromium en el CRM.")); });
        request.end(firmado.cuerpo);
      });
    },
    async abrirVisor(numero, id, actor) {
      const firmado = firmarOperacion({ op: "visor", numero, payload: { id } }, actor, config.key);
      const url = new URL("/v1/visor", config.url);
      url.protocol = "wss:";
      url.searchParams.set("numero", numero);
      url.searchParams.set("id", id);
      const ws = new WebSocket(url, { ...config.tls, headers: firmado.headers, perMessageDeflate: false,
        maxPayload: 65_536, handshakeTimeout: 10_000 });
      return new Promise((resolve, reject) => {
        ws.once("open", () => { ws.pause(); resolve(ws); });
        ws.once("error", () => { ws.terminate(); reject(new ErrorRemotoWhatsapp("VISOR_WHATSAPP", "No se pudo abrir la pantalla privada de la VM.")); });
      });
    },
    cerrar() { config.agente.destroy(); },
  };
}
