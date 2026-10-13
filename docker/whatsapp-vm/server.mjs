import https from "node:https";
import net from "node:net";
import { X509Certificate } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { verificarOperacion, CABECERAS_PRIVADAS, ErrorRemotoWhatsapp, UUID } from "../whatsapp-wire.mjs";

export function crearServidorWhatsapp({ tls, fingerprints, operar, escritorio, disponible, intervalo = 5000 }) {
  const certificadoServidor = new X509Certificate(tls.cert);
  const vigente = (cert) => Date.now() >= Date.parse(cert.validFrom) && Date.now() < Date.parse(cert.validTo);
  if (!vigente(certificadoServidor)) throw new Error("El certificado del servidor requiere renovación.");
  const permitidos = new Set(fingerprints.split(",").map((f) => f.replaceAll(":", "").toLowerCase()));
  if (!permitidos.size || [...permitidos].some((f) => !/^[a-f0-9]{64}$/.test(f))) throw new Error("Faltan las huellas de los certificados autorizados del CRM.");
  const nonces = new Map();
  const visores = new Map();
  const reservas = new Map();
  let pendientes = 0;
  let cerrando = false;
  const wsServer = new WebSocketServer({ noServer: true, maxPayload: 65_536, perMessageDeflate: false });
  function peer(request) {
    const certificado = request.socket.getPeerCertificate();
    if (!request.socket.authorized || !certificado.raw || !permitidos.has(certificado.fingerprint256?.replaceAll(":", "").toLowerCase())) {
      throw new ErrorRemotoWhatsapp("CLIENTE_NO_AUTORIZADO", "Acceso no permitido.", 403);
    }
    const x509 = new X509Certificate(certificado.raw);
    if (!vigente(x509) || !vigente(certificadoServidor)) throw new ErrorRemotoWhatsapp("CERTIFICADO_WHATSAPP", "El certificado requiere renovación.", 403);
    return x509;
  }
  function responder(response, status, datos) {
    response.writeHead(status, { ...CABECERAS_PRIVADAS, "Content-Type": "application/json" });
    response.end(JSON.stringify(datos));
  }
  function fallo(response, error) {
    const conocido = typeof error?.codigo === "string" && Number.isInteger(error.status);
    responder(response, conocido ? error.status : 503, { codigo: conocido ? error.codigo : "SERVICIO_WHATSAPP", error: conocido ? error.message : "El servicio de WhatsApp no está disponible; los perfiles se conservan." });
  }
  const servidor = https.createServer({ ...tls, minVersion: "TLSv1.3", requestCert: true, rejectUnauthorized: true }, async (request, response) => {
    let reservada = false;
    try {
      const certificado = peer(request);
      if (cerrando || !await disponible()) throw new ErrorRemotoWhatsapp("SERVICIO_NO_LISTO", "El servicio no está listo.");
      if (request.method === "GET" && request.url === "/healthz") { responder(response, 200, { ok: true }); return; }
      if (request.method !== "POST" || request.url !== "/v1/operacion" || request.headers["content-type"] !== "application/json") {
        responder(response, 404, { error: "Ruta no disponible." }); return;
      }
      if (pendientes >= 32) throw new ErrorRemotoWhatsapp("SERVICIO_OCUPADO", "El servicio está ocupado.", 429);
      pendientes++; reservada = true;
      let longitud = 0;
      const partes = [];
      for await (const datos of request) {
        longitud += datos.length;
        if (longitud > 65_536) throw new ErrorRemotoWhatsapp("CUERPO_GRANDE", "Solicitud demasiado grande.", 413);
        partes.push(datos);
      }
      const { entrada, actor } = verificarOperacion(Buffer.concat(partes).toString(), request.headers, certificado, nonces);
      if (cerrando || !await disponible()) throw new ErrorRemotoWhatsapp("SERVICIO_NO_LISTO", "El servicio se está deteniendo.");
      if (entrada.op === "visor") throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "El visor requiere WSS.", 400);
      const resultado = await operar(entrada, actor);
      responder(response, 200, { resultado });
    } catch (error) { if (!response.destroyed) fallo(response, error); }
    finally { if (reservada) pendientes--; }
  });
  servidor.headersTimeout = 10_000;
  servidor.requestTimeout = 15_000;
  servidor.timeout = 120_000;
  servidor.on("tlsClientError", () => {});
  function rechazar(socket, status = 403) {
    if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Rejected\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
  servidor.on("upgrade", async (request, socket, head) => {
    socket.on("error", () => {});
    let tcp;
    let reserva;
    let transferida = false;
    try {
      const certificado = peer(request);
      if (cerrando || !await disponible() || request.headers.origin) throw new ErrorRemotoWhatsapp("VISOR_PRIVADO", "Acceso no permitido.", 403);
      const url = new URL(request.url, "https://localhost");
      const numero = url.searchParams.get("numero");
      const id = url.searchParams.get("id");
      if (url.pathname !== "/v1/visor" || !/^9\d{8}$/.test(numero ?? "") || !UUID.test(id ?? "")) throw new ErrorRemotoWhatsapp("VISOR_INVALIDO", "Visor inválido.", 400);
      const cuerpo = JSON.stringify({ op: "visor", numero, payload: { id } });
      const { actor } = verificarOperacion(cuerpo, request.headers, certificado, nonces);
      if (visores.size + reservas.size >= 16 || [...visores.values(), ...reservas.values()].filter((v) => v === actor.userId).length >= 4) {
        throw new ErrorRemotoWhatsapp("VISOR_OCUPADO", "Demasiadas pantallas abiertas.", 429);
      }
      reserva = Symbol(); reservas.set(reserva, actor.userId);
      const acceso = await escritorio(numero, id, actor);
      tcp = net.createConnection({ host: "127.0.0.1", port: acceso.puerto });
      tcp.pause(); tcp.setTimeout(5000, () => tcp.destroy());
      await new Promise((resolve, reject) => {
        tcp.once("connect", resolve); tcp.once("error", reject); tcp.once("close", () => reject(new Error("Visor cerrado")));
      });
      const actualizado = await escritorio(numero, id, actor);
      if (cerrando || !await disponible()) throw new Error("Visor cerrado");
      if (actualizado.puerto !== acceso.puerto || tcp.destroyed || socket.destroyed) throw new Error("Visor cerrado");
      tcp.setTimeout(0);
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        transferida = true;
        visores.set(ws, actor.userId);
        let terminada = false;
        let timer;
        function cerrar(code = 4004) {
          if (terminada) return;
          terminada = true;
          clearTimeout(timer); visores.delete(ws); tcp.destroy();
          if (ws.readyState === WebSocket.OPEN) ws.close(code);
          const corte = setTimeout(() => ws.terminate(), 1000); corte.unref();
        }
        async function comprobar() {
          try {
            if (!await disponible() || !vigente(certificado) || !vigente(certificadoServidor) ||
              (await escritorio(numero, id, actor)).puerto !== acceso.puerto) { cerrar(); return; }
            ws.ping();
          } catch { cerrar(); return; }
          if (!terminada) timer = setTimeout(() => void comprobar(), intervalo);
        }
        timer = setTimeout(() => void comprobar(), intervalo);
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
        tcp.once("error", () => cerrar(1011)); tcp.once("close", () => cerrar());
        ws.once("error", () => cerrar(1011)); ws.once("close", () => cerrar());
        tcp.resume();
      });
    } catch (error) { rechazar(socket, Number.isInteger(error?.status) ? error.status : 503); }
    finally { if (reserva) reservas.delete(reserva); if (!transferida) tcp?.destroy(); }
  });
  return {
    servidor,
    detenerIngreso() { cerrando = true; for (const ws of visores.keys()) ws.terminate(); },
    async cerrar() {
      cerrando = true;
      for (const ws of visores.keys()) ws.terminate();
      wsServer.close(); servidor.closeAllConnections();
      await new Promise((resolve) => servidor.close(resolve));
    },
  };
}
