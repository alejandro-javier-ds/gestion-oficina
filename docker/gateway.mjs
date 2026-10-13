import http from "node:http";
import net from "node:net";
import { WebSocketServer, WebSocket, createWebSocketStream } from "ws";
import { crearClienteWhatsapp, modoWhatsapp } from "./whatsapp-wire.mjs";

const RUTA_AUTORIZAR = "/api/whatsapp/visor/autorizar";
const RUTA_CONEXION = "/api/whatsapp/visor/conexion";
const CABECERA_INTERNA = "x-whatsapp-visor-interno";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function validarOrigenVisor(valor) {
  const url = new URL(valor);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.origin !== valor || valor.includes("*") || url.username || url.password ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("CRM_PUBLIC_ORIGIN debe contener un único origen HTTPS sin ruta ni comodines.");
  }
  return url;
}

export function crearGateway({ puertoNext, secreto, origen, intervaloAutorizacion = 5000 }) {
  const permitido = validarOrigenVisor(origen);
  const remoto = modoWhatsapp() === "remote";
  let clienteRemoto = null;
  if (!Number.isSafeInteger(puertoNext) || puertoNext < 1 || puertoNext > 65535 || secreto.length < 32) {
    throw new Error("No se pudo configurar el visor.");
  }
  const conexiones = new Map();
  const reservas = new Map();
  const websocket = new WebSocketServer({ noServer: true, maxPayload: 65_536, perMessageDeflate: false });
  const agente = new http.Agent({ keepAlive: true });
  const servidor = http.createServer((request, response) => {
    let ruta;
    try { ruta = new URL(request.url, "http://localhost").pathname; }
    catch { response.writeHead(400); response.end(); return; }
    if (ruta === RUTA_AUTORIZAR || ruta === RUTA_CONEXION) {
      response.writeHead(403, { "Cache-Control": "private, no-store" }); response.end(); return;
    }
    const headers = { ...request.headers };
    delete headers[CABECERA_INTERNA];
    delete headers["x-gestion-sesion-verificada"];
    delete headers.connection;
    delete headers.upgrade;
    const remoto = http.request({ host: "127.0.0.1", port: puertoNext, path: request.url,
      method: request.method, headers, agent: agente }, (resultado) => {
      const cabeceras = { ...resultado.headers };
      delete cabeceras.connection;
      if (ruta.startsWith("/whatsapp/visor") || ruta.startsWith("/api/whatsapp/visor")) {
        cabeceras["cache-control"] = "private, no-store, max-age=0";
        cabeceras["x-frame-options"] = "DENY";
        cabeceras["referrer-policy"] = "no-referrer";
      }
      response.writeHead(resultado.statusCode ?? 502, cabeceras);
      resultado.pipe(response);
    });
    remoto.once("error", () => {
      if (!response.headersSent) response.writeHead(502, { "Cache-Control": "no-store" });
      response.end("La aplicación todavía no está disponible.");
    });
    response.once("close", () => remoto.destroy());
    request.pipe(remoto);
  });
  function rechazar(socket, status) {
    if (socket.destroyed) return;
    const nombre = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
      409: "Conflict", 429: "Too Many Requests", 503: "Service Unavailable" }[status] ?? "Forbidden";
    socket.end("HTTP/1.1 " + status + " " + nombre + "\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
  }
  async function autorizar(cookie, numero, id) {
    const resultado = await fetch("http://127.0.0.1:" + puertoNext + RUTA_AUTORIZAR, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", Cookie: cookie, [CABECERA_INTERNA]: secreto,
        Host: permitido.host, "X-Forwarded-Proto": permitido.protocol.slice(0, -1) },
      body: JSON.stringify({ numero, id }),
    });
    if (!resultado.ok) return { status: [401, 403, 409].includes(resultado.status) ? resultado.status : 503 };
    const datos = await resultado.json();
    if (!Number.isSafeInteger(datos.usuarioId) || datos.usuarioId <= 0 || datos.id !== id ||
      (remoto ? datos.remoto !== true || !["administrador", "supervisor"].includes(datos.rol)
        : datos.remoto === true || !Number.isSafeInteger(datos.puerto) || datos.puerto < 1 || datos.puerto > 65535)) return { status: 503 };
    return { status: 200, ...datos };
  }
  function mismoDestino(a, b) {
    return a.status === 200 && a.usuarioId === b.usuarioId && a.id === b.id &&
      (remoto ? a.remoto === true && a.rol === b.rol : a.puerto === b.puerto);
  }
  servidor.on("upgrade", async (request, socket, head) => {
    socket.on("error", () => {});
    let url;
    try { url = new URL(request.url, permitido); }
    catch { rechazar(socket, 400); return; }
    if (url.pathname !== RUTA_CONEXION) { rechazar(socket, 404); return; }
    if (request.headers.origin !== permitido.origin ||
      (permitido.protocol === "https:" && request.headers["x-forwarded-proto"] !== "https")) {
      rechazar(socket, 403); return;
    }
    const cookie = request.headers.cookie;
    if (!cookie) { rechazar(socket, 401); return; }
    const numero = url.searchParams.get("numero") ?? "";
    const id = url.searchParams.get("id") ?? "";
    if (!/^9\d{8}$/.test(numero) || !UUID.test(id) || cookie.length > 16_384) { rechazar(socket, 400); return; }
    let reserva;
    let tcp;
    let transferida = false;
    try {
      const acceso = await autorizar(cookie, numero, id);
      if (socket.destroyed) return;
      if (acceso.status !== 200) { rechazar(socket, acceso.status); return; }
      if (conexiones.size + reservas.size >= 32 ||
        [...conexiones.values()].filter((c) => c.usuarioId === acceso.usuarioId).length +
        [...reservas.values()].filter((usuarioId) => usuarioId === acceso.usuarioId).length >= 4) {
        rechazar(socket, 429); return;
      }
      reserva = Symbol(); reservas.set(reserva, acceso.usuarioId);
      let conectado;
      if (remoto) {
        clienteRemoto ??= crearClienteWhatsapp();
        const wsRemoto = await clienteRemoto.abrirVisor(numero, id, { userId: acceso.usuarioId, rol: acceso.rol, debeCambiarContrasena: false });
        tcp = createWebSocketStream(wsRemoto);
        tcp.on("error", () => {});
        tcp.pause();
        conectado = true;
      } else {
        tcp = net.createConnection({ host: "127.0.0.1", port: acceso.puerto });
        tcp.pause();
        tcp.setTimeout(5000, () => tcp.destroy());
        conectado = await new Promise((resolve) => {
          tcp.once("connect", () => resolve(true));
          tcp.once("error", () => resolve(false));
          tcp.once("close", () => resolve(false));
        });
      }
      if (!conectado || socket.destroyed) { tcp.destroy(); rechazar(socket, 503); return; }
      tcp.setTimeout?.(0);
      const vigente = await autorizar(cookie, numero, id);
      if (socket.destroyed) return;
      if (tcp.destroyed) { rechazar(socket, 503); return; }
      if (!mismoDestino(vigente, acceso)) {
        tcp.destroy(); rechazar(socket, vigente.status === 200 ? 409 : vigente.status); return;
      }
      websocket.handleUpgrade(request, socket, head, (ws) => {
        transferida = true;
        const sesion = { usuarioId: acceso.usuarioId };
        conexiones.set(ws, sesion);
        let temporizador;
        let terminada = false;
        const cerrar = (codigo = 1000) => {
          if (terminada) return;
          terminada = true;
          clearTimeout(temporizador);
          conexiones.delete(ws);
          tcp.destroy();
          if (ws.readyState === WebSocket.OPEN) ws.close(codigo);
          const corte = setTimeout(() => ws.terminate(), 1000); corte.unref();
        };
        async function comprobar() {
          try {
            const nueva = await autorizar(cookie, numero, id);
            if (!mismoDestino(nueva, acceso)) {
              cerrar(nueva.status === 401 || nueva.status === 403 ? 4003 : 4004); return;
            }
            ws.ping();
          } catch { cerrar(4004); return; }
          if (!terminada) temporizador = setTimeout(() => void comprobar(), intervaloAutorizacion);
        }
        temporizador = setTimeout(() => void comprobar(), intervaloAutorizacion);
        tcp.on("data", (datos) => {
          tcp.pause();
          if (ws.readyState !== WebSocket.OPEN) { cerrar(); return; }
          ws.send(datos, { binary: true }, (error) => { if (error) cerrar(); else if (!terminada) tcp.resume(); });
        });
        ws.on("message", (datos, binario) => {
          if (!binario || terminada) { cerrar(1003); return; }
          if (!tcp.write(datos)) ws.pause();
        });
        tcp.on("drain", () => { if (!terminada) ws.resume(); });
        tcp.once("error", () => cerrar(1011));
        tcp.once("close", () => cerrar(4004));
        ws.once("error", () => cerrar(1011));
        ws.once("close", () => cerrar());
        tcp.resume();
      });
    } catch { rechazar(socket, 503); }
    finally {
      if (reserva) reservas.delete(reserva);
      if (!transferida) tcp?.destroy();
    }
  });
  return {
    servidor,
    async cerrar() {
      for (const ws of conexiones.keys()) ws.terminate();
      agente.destroy();
      clienteRemoto?.cerrar();
      websocket.close();
      servidor.closeAllConnections();
      await new Promise((resolve) => servidor.close(resolve));
    },
  };
}
