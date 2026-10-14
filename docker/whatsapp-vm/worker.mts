import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { crearServidorWhatsapp } from "./server.mjs";
import { validarDisco, escribirAtomico, sincronizarDirectorio } from "./storage.mjs";
import { crearCoordinadorMantenimiento, recuperarReservasHuerfanas, validarCampanasGuardadas } from "./coordination.mjs";
import { crearRegistroEnvios } from "./journal.mjs";
import { ErrorRemotoWhatsapp, type ActorWhatsapp, type OperacionWhatsapp } from "../whatsapp-wire.mjs";

process.umask(0o077);
process.env.WHATSAPP_SERVICE = "1";
process.env.WHATSAPP_BACKEND = "local";
process.env.WHATSAPP_REMOTE_VIEWER = "1";
process.env.WHATSAPP_SESSIONS_DIR = "/data/whatsapp-sessions";
process.env.HOME = "/data/runtime";
process.env.TMPDIR = "/data/runtime/tmp";

if (process.getuid?.() !== 999 || process.getgid?.() !== 988) throw new Error("El servicio requiere el usuario 999:988.");
await validarDisco();
await fs.mkdir(process.env.TMPDIR, { recursive: true, mode: 0o700 });
const motor = await import("../../lib/whatsapp/playwright-local");
const envio = await import("../../lib/whatsapp/envio-local");
type Propietario = { temporal: boolean; userId: number | null };
const archivoSesiones = "/data/sesiones.json";
const propietarios = new Map<string, Propietario>();
try {
  const guardados = JSON.parse(await fs.readFile(archivoSesiones, "utf8"));
  if (!guardados || typeof guardados !== "object" || Array.isArray(guardados) || Object.keys(guardados).length > 1000) throw new Error("Registro inválido");
  for (const [numero, dato] of Object.entries(guardados) as [string, Propietario][]) {
    if (!/^9\d{8}$/.test(numero) || typeof dato?.temporal !== "boolean" ||
      (dato.temporal ? !Number.isSafeInteger(dato.userId) || Number(dato.userId) < 1 : dato.userId !== null)) throw new Error("Registro inválido");
    propietarios.set(numero, dato);
  }
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("El registro de sesiones requiere revisión; no se modifica."); }
let escritura = Promise.resolve();
function guardarPropietarios() {
  const nueva = escritura.catch(() => {}).then(() => escribirAtomico(archivoSesiones, Object.fromEntries(propietarios)));
  escritura = nueva;
  return nueva;
}
const trabajos = new Set<Promise<unknown>>();
const iniciando = new Map<string, Promise<unknown>>();
const ocupados = new Set<string>();
const archivoCampanas = "/data/.active-campaigns.json";
let campanasGuardadas: Record<string, { campanaId: number; userId: number }> = {};
try { campanasGuardadas = validarCampanasGuardadas(JSON.parse(await fs.readFile(archivoCampanas, "utf8"))); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("El registro de campañas activas requiere revisión; no se modifica."); }
const carpetaRecuperacionCampanas = "/data/.campaign-recovery";
const recuperacionCampanas = await recuperarReservasHuerfanas({
  guardadas: campanasGuardadas,
  archivar: async (reservas: Record<string, { campanaId: number; userId: number }>) => {
    await fs.mkdir(carpetaRecuperacionCampanas, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(carpetaRecuperacionCampanas);
    if (!stat.isDirectory() || stat.uid !== 999 || (stat.mode & 0o077) !== 0 || await fs.realpath(carpetaRecuperacionCampanas) !== carpetaRecuperacionCampanas) throw new Error("El archivo de recuperación de campañas no es seguro.");
    const archivo = path.join(carpetaRecuperacionCampanas, `${Date.now()}-${randomUUID()}.json`);
    const handle = await fs.open(archivo, "wx", 0o600);
    let persistido = false;
    try {
      await handle.writeFile(JSON.stringify({ version: 1, fecha: new Date().toISOString(), reservas }));
      await handle.sync();
      persistido = true;
    } finally {
      await handle.close();
      if (!persistido) await fs.unlink(archivo).catch(() => {});
    }
    await sincronizarDirectorio(carpetaRecuperacionCampanas);
  },
  guardar: (reservas: Record<string, { campanaId: number; userId: number }>) => escribirAtomico(archivoCampanas, reservas),
});
campanasGuardadas = recuperacionCampanas.guardadas;
if (recuperacionCampanas.recuperadas > 0) console.log(JSON.stringify({ evento: "reservas_campana_huerfanas_recuperadas", cantidad: recuperacionCampanas.recuperadas }));
const archivoMantenimiento = "/run/crm-control/maintenance.json";
let mantenimientoInicial = false;
try {
  const stat = await fs.lstat(archivoMantenimiento);
  if (!stat.isFile() || stat.uid !== 999 || (stat.mode & 0o077) !== 0 || stat.size > 64) throw new Error("Registro de mantenimiento inválido");
  const estadoMantenimiento = JSON.parse(await fs.readFile(archivoMantenimiento, "utf8"));
  if (estadoMantenimiento?.v !== 1 || typeof estadoMantenimiento.mantenimiento !== "boolean") throw new Error("Registro de mantenimiento inválido");
  mantenimientoInicial = estadoMantenimiento.mantenimiento;
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("El registro de mantenimiento requiere revisión; no se modifica."); }
const coordinador = crearCoordinadorMantenimiento({ guardadas: campanasGuardadas, guardar: (estado: Record<string, { campanaId: number; userId: number }>) => escribirAtomico(archivoCampanas, estado), guardarMantenimiento: (mantenimiento?: boolean) => escribirAtomico(archivoMantenimiento, { v: 1, mantenimiento: mantenimiento === true }), mantenimientoInicial, exigirReservas: process.env.WHATSAPP_REQUIRE_CAMPAIGN_LEASES === "true" });
const maxSesiones = Number(process.env.WHATSAPP_MAX_SESSIONS ?? 3);
if (!Number.isInteger(maxSesiones) || maxSesiones < 1 || maxSesiones > 20) throw new Error("WHATSAPP_MAX_SESSIONS debe estar entre 1 y 20.");
let listo = true;
let parando = false;
function autorizarPropietario(numero: string, actor: ActorWhatsapp) {
  const propietario = propietarios.get(numero);
  if (propietario?.temporal && (propietario.userId !== actor.userId || actor.rol === "gestor")) {
    throw new ErrorRemotoWhatsapp("NUMERO_NO_AUTORIZADO", "No tienes permiso para acceder a esa sesión.", 403);
  }
}
async function escritorio(numero: string, id: string, actor: ActorWhatsapp) {
  autorizarPropietario(numero, actor);
  const ventana = motor.obtenerEscritorioWhatsapp(numero);
  if (!ventana || ventana.id !== id) throw new ErrorRemotoWhatsapp("VISOR_CERRADO", "La ventana ya no está disponible.", 409);
  return ventana;
}
const registrarEnvio = crearRegistroEnvios("/data/envios", async (numero: string, destino: string, mensaje: string) => {
  const corte = setTimeout(() => { void motor.cerrarWhatsapp(numero).catch(() => {}); }, 75_000);
  try { return await envio.enviarUnMensajeWhatsapp(numero, destino, mensaje); }
  finally { clearTimeout(corte); }
});
async function operar(entrada: OperacionWhatsapp, actor: ActorWhatsapp): Promise<unknown> {
  const numero = entrada.numero ?? "";
  if (!coordinador.admite(entrada, actor)) throw new ErrorRemotoWhatsapp("MANTENIMIENTO_WHATSAPP", "WhatsApp está entrando en mantenimiento; la operación no se inició.", 503);
  if (numero) autorizarPropietario(numero, actor);
  switch (entrada.op) {
    case "campana": {
      if (entrada.payload.accion === "iniciar") return { leaseId: await coordinador.iniciarCampana(entrada.payload.campanaId, actor.userId) };
      return coordinador.finalizarCampana(entrada.payload.leaseId, entrada.payload.campanaId, actor.userId);
    }
    case "temporales": return [...propietarios].filter(([, p]) => p.temporal && p.userId === actor.userId).map(([n]) => n);
    case "estado": return motor.obtenerEstadoWhatsapp(numero);
    case "qr": return motor.obtenerVinculacionWhatsapp(numero);
    case "metadatos": {
      const escritorio = motor.obtenerEscritorioWhatsapp(numero);
      const propietario = propietarios.get(numero);
      return { iniciado: motor.existeSesionWhatsapp(numero), temporal: propietario?.temporal ?? false,
        usuarioTemporalId: propietario?.temporal ? propietario.userId : null, visor: escritorio ? { id: escritorio.id, remoto: true } : null };
    }
    case "iniciar": {
      if (ocupados.has(numero)) throw new ErrorRemotoWhatsapp("SESION_OCUPADA", "La sesión está procesando un envío.", 409);
      if (iniciando.has(numero)) return iniciando.get(numero);
      const temporal = entrada.payload.temporal === true;
      const previo = propietarios.get(numero);
      if (previo && previo.temporal !== temporal) throw new ErrorRemotoWhatsapp("TIPO_SESION", "La sesión tiene otro tipo. Cierra la temporal antes de utilizar un perfil permanente.", 409);
      const activos = [...propietarios.keys()].filter((n) => motor.existeSesionWhatsapp(n) && !iniciando.has(n)).length;
      if (!motor.existeSesionWhatsapp(numero) && activos + iniciando.size >= maxSesiones) throw new ErrorRemotoWhatsapp("LIMITE_SESIONES", "Cierra una ventana de WhatsApp antes de abrir otra.", 429);
      const promesa = (async () => {
        propietarios.set(numero, { temporal, userId: temporal ? actor.userId : null });
        await guardarPropietarios();
        return motor.iniciarWhatsapp(numero, temporal, actor.userId);
      })();
      iniciando.set(numero, promesa);
      try { return await promesa; } finally { iniciando.delete(numero); }
    }
    case "cerrarTemporal": {
      if (ocupados.has(numero) || iniciando.has(numero)) throw new ErrorRemotoWhatsapp("SESION_OCUPADA", "La sesión está ocupada.", 409);
      const propietario = propietarios.get(numero);
      if (!propietario?.temporal || propietario.userId !== actor.userId) throw new ErrorRemotoWhatsapp("SESION_NO_TEMPORAL", "Los perfiles permanentes se conservan.", 409);
      ocupados.add(numero);
      try {
        if (!motor.existeSesionWhatsapp(numero)) await motor.iniciarWhatsapp(numero, true, actor.userId);
        await motor.cerrarYEliminarWhatsappTemporal(numero);
        propietarios.delete(numero); await guardarPropietarios();
        return { ok: true };
      } finally { ocupados.delete(numero); }
    }
    case "enviar": {
      if (process.env.WHATSAPP_REQUIRE_CAMPAIGN_LEASES === "true" && (!coordinador.validarEnvio(entrada.payload.leaseId, actor.userId) || actor.campanaLeaseId !== entrada.payload.leaseId)) throw new ErrorRemotoWhatsapp("CAMPANA_NO_AUTORIZADA", "El envío no pertenece a una campaña activa.", 409);
      if (ocupados.has(numero) || iniciando.has(numero)) throw new ErrorRemotoWhatsapp("SESION_OCUPADA", "La sesión está ocupada; no se inició otro envío.", 409);
      ocupados.add(numero);
      try { return await registrarEnvio(entrada, actor); } finally { ocupados.delete(numero); }
    }
    default: throw new ErrorRemotoWhatsapp("OPERACION_INVALIDA", "Operación inválida.", 400);
  }
}
const servicio = crearServidorWhatsapp({
  tls: { ca: await fs.readFile("/tls/ca.crt"), cert: await fs.readFile("/tls/server.crt"), key: await fs.readFile("/tls/server.key") },
  fingerprints: process.env.WHATSAPP_CLIENT_FINGERPRINTS ?? "",
  disponible: async () => listo && !parando,
  admiteVisor: async () => listo && !parando && !coordinador.estado().mantenimiento,
  escritorio,
  operar(entrada: OperacionWhatsapp, actor: ActorWhatsapp) {
    const trabajo = operar(entrada, actor);
    trabajos.add(trabajo);
    void trabajo.finally(() => trabajos.delete(trabajo)).catch(() => {});
    return trabajo;
  },
});
const control = net.createServer((socket) => {
  socket.setTimeout(5000, () => socket.destroy());
  let cuerpo = "";
  socket.on("data", (datos) => {
    cuerpo += datos.toString("utf8");
    if (Buffer.byteLength(cuerpo) > 4096) { socket.destroy(); return; }
    const separador = cuerpo.indexOf("\n");
    if (separador < 0) return;
    socket.pause();
    void (async () => {
      let resultado: unknown;
      try {
        const solicitud = JSON.parse(cuerpo.slice(0, separador));
        if (solicitud.op === "prepare") {
          socket.setTimeout(0);
          resultado = await coordinador.preparar({ trabajosPendientes: () => trabajos.size,
          cerrarVisores: () => servicio.cerrarVisores(), timeoutMs: Number.isInteger(solicitud.timeoutMs) && solicitud.timeoutMs >= 1000 && solicitud.timeoutMs <= 7_200_000 ? solicitud.timeoutMs : 7_200_000 });
        } else if (solicitud.op === "abort") resultado = await coordinador.abortar({ trabajosPendientes: () => trabajos.size });
        else if (solicitud.op === "status") resultado = { ...coordinador.estado(), operacionesActivas: trabajos.size };
        else resultado = { ok: false, motivo: "operacion_invalida" };
      } catch { resultado = { ok: false, motivo: "coordinacion_no_disponible" }; }
      if (!socket.destroyed) socket.end(JSON.stringify(resultado) + "\n");
    })();
  });
});
const controlSocket = "/run/crm-control/maintenance.sock";
await fs.unlink(controlSocket).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
await new Promise<void>((resolve, reject) => { control.once("error", reject); control.listen(controlSocket, resolve); });
await fs.chmod(controlSocket, 0o600);
const health = http.createServer((_request, response) => { response.writeHead(listo && !parando ? 200 : 503); response.end(); });
const healthSocket = "/tmp/whatsapp-health.sock";
await fs.unlink(healthSocket).catch((e: NodeJS.ErrnoException) => { if (e.code !== "ENOENT") throw e; });
await new Promise<void>((resolve, reject) => { health.once("error", reject); health.listen(healthSocket, resolve); });
await fs.chmod(healthSocket, 0o600);
await new Promise<void>((resolve, reject) => { servicio.servidor.once("error", reject); servicio.servidor.listen(8443, "0.0.0.0", resolve); });
const vigilancia = setInterval(() => {
  void validarDisco().catch(() => { listo = false; console.error("Se perdió el disco de WhatsApp; se detiene el servicio."); void detener(1); });
}, 10_000);
async function detener(codigo: number) {
  if (parando) return;
  parando = true; listo = false;
  clearInterval(vigilancia);
  servicio.detenerIngreso();
  const corte = setTimeout(() => process.exit(1), 115_000); corte.unref();
  await Promise.allSettled([...trabajos]);
  await Promise.allSettled([...propietarios.keys()].map(motor.cerrarWhatsapp));
  await escritura.catch(() => {});
  await servicio.cerrar();
  await new Promise<void>((resolve) => control.close(() => resolve()));
  await new Promise<void>((resolve) => health.close(() => resolve()));
  clearTimeout(corte);
  process.exit(codigo);
}
process.once("SIGTERM", () => void detener(0));
process.once("SIGINT", () => void detener(0));
process.once("uncaughtException", () => { console.error("Fallo del servicio de WhatsApp; se conserva el disco."); void detener(1); });
process.once("unhandledRejection", () => { console.error("Operación de WhatsApp fallida; se conserva el disco."); void detener(1); });
console.log("Servicio privado de WhatsApp listo en 8443 con mTLS y perfiles ext4.");
