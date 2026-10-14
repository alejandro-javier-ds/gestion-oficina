import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, publicEncrypt, privateDecrypt, constants } from "node:crypto";
import { sincronizarDirectorio } from "./storage.mjs";

process.umask(0o077);
const rootPruebas = process.env.NODE_ENV === "test" && process.env.WHATSAPP_TEST_ROOT ? path.resolve(process.env.WHATSAPP_TEST_ROOT) : null;
const directorioDatos = rootPruebas ? path.join(rootPruebas, "data") : "/data";
const directorioRecuperacion = rootPruebas ? path.join(rootPruebas, "recovery") : "/recovery";
const directorioRespaldos = rootPruebas ? path.join(directorioDatos, "profile-backups") : process.env.WHATSAPP_BACKUP_DIRECTORY || path.join(directorioDatos, "profile-backups");
const directorioScript = path.dirname(fileURLToPath(import.meta.url));
const archivos = ["whatsapp-sessions", "envios", "sesiones.json"];
const ignorados = new Set(["SingletonLock", "SingletonSocket", "SingletonCookie", ".crm-chromium.lock"]);
async function comprobarArbol(carpeta) {
  for (const entrada of await fs.readdir(carpeta, { withFileTypes: true })) {
    if (ignorados.has(entrada.name)) continue;
    if (entrada.isDirectory()) await comprobarArbol(path.join(carpeta, entrada.name));
    else if (!entrada.isFile()) throw new Error("El perfil contiene enlaces o archivos especiales que requieren revisión.");
  }
}
function ejecutar(programa, argumentos) {
  const proceso = spawn(programa, argumentos, { stdio: ["ignore", "pipe", rootPruebas ? "pipe" : "ignore"] });
  const diagnostico = [];
  proceso.stderr?.on("data", (datos) => diagnostico.push(datos.toString("utf8")));
  const fin = new Promise((resolve, reject) => {
    proceso.once("error", reject);
    proceso.once("close", (code) => code === 0 ? resolve() : reject(new Error(rootPruebas ? diagnostico.join("").trim() || "No se pudo procesar el respaldo de perfiles." : "No se pudo procesar el respaldo de perfiles.")));
  });
  void fin.catch(() => {});
  return { proceso, fin };
}
async function hashArchivo(archivo) {
  const hash = createHash("sha256");
  for await (const datos of createReadStream(archivo)) hash.update(datos);
  return hash.digest("hex");
}
async function backup() {
  const carpeta = directorioRespaldos;
  await fs.mkdir(carpeta, { recursive: true, mode: 0o700 });
  const destinoReal = path.join(await fs.realpath(path.dirname(carpeta)), path.basename(carpeta));
  if (await fs.realpath(carpeta) !== destinoReal) throw new Error("La carpeta de respaldos no puede ser un enlace.");
  const presentes = [];
  for (const archivo of archivos) {
    const stat = await fs.lstat(path.join(directorioDatos, archivo)).catch((e) => { if (e.code !== "ENOENT") throw e; return null; });
    if (!stat) continue;
    if (stat.isDirectory()) await comprobarArbol(path.join(directorioDatos, archivo));
    else if (!stat.isFile()) throw new Error("Registro de sesiones inválido.");
    presentes.push(archivo);
  }
  if (!presentes.includes("whatsapp-sessions")) throw new Error("No hay perfiles para respaldar.");
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const wrap = publicEncrypt({ key: await fs.readFile(path.join(directorioRecuperacion, "public.pem")), oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING }, key);
  const cabecera = Buffer.from(JSON.stringify({ v: 1, cipher: "aes-256-gcm", wrap: wrap.toString("base64"), iv: iv.toString("base64"), fecha: new Date().toISOString() }));
  const longitud = Buffer.alloc(4); longitud.writeUInt32BE(cabecera.length);
  const nombre = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID() + ".wa-backup";
  const temporal = path.join(carpeta, "." + nombre + ".tmp");
  const destino = path.join(carpeta, nombre);
  const handle = await fs.open(temporal, "wx", 0o600);
  await handle.write(Buffer.concat([longitud, cabecera])); await handle.close();
  const cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(cabecera);
  const opcionesTar = ["--create", "--file=-", "--format=pax", ...(rootPruebas ? [] : ["--hard-dereference"]), "--directory=" + directorioDatos,
    ...[...ignorados].map((nombre) => "--exclude=*/" + nombre), ...presentes];
  const { proceso, fin } = ejecutar("tar", opcionesTar);
  try {
    await pipeline(proceso.stdout, cipher, createWriteStream(temporal, { flags: "a", mode: 0o600 }));
    await fin;
    const archivo = await fs.open(temporal, "a");
    try { await archivo.write(cipher.getAuthTag()); await archivo.sync(); } finally { await archivo.close(); }
    await fs.link(temporal, destino); await fs.unlink(temporal); await sincronizarDirectorio(carpeta);
    const hash = await hashArchivo(destino);
    console.log(JSON.stringify({ archivo: destino, sha256: hash, cifrado: "AES-256-GCM", copiaEnFrio: true }));
  } catch (error) { proceso.kill("SIGKILL"); await fs.unlink(temporal).catch(() => {}); throw error; }
  finally { key.fill(0); }
}
async function restore(archivo) {
  const carpetaOrigen = path.join(directorioDatos, "profile-backups");
  const rutaArchivo = path.resolve(archivo || "");
  if (!archivo || path.dirname(rutaArchivo) !== path.resolve(carpetaOrigen) || !/^[\w.-]+\.wa-backup$/.test(path.basename(rutaArchivo))) throw new Error("Selecciona un respaldo de profile-backups.");
  const stat = await fs.lstat(rutaArchivo);
  if (!stat.isFile() || stat.size < 100 || stat.size > 50 * 1024 ** 3) throw new Error("Respaldo inválido.");
  const input = await fs.open(rutaArchivo, "r");
  const longitud = Buffer.alloc(4); await input.read(longitud, 0, 4, 0);
  const n = longitud.readUInt32BE();
  if (n < 10 || n > 4096 || n + 20 >= stat.size) { await input.close(); throw new Error("Cabecera de respaldo inválida."); }
  const cabecera = Buffer.alloc(n); await input.read(cabecera, 0, n, 4);
  const tag = Buffer.alloc(16); await input.read(tag, 0, 16, stat.size - 16); await input.close();
  const datos = JSON.parse(cabecera.toString());
  if (datos.v !== 1 || datos.cipher !== "aes-256-gcm") throw new Error("Formato de respaldo inválido.");
  const key = privateDecrypt({ key: await fs.readFile(path.join(directorioRecuperacion, "private.pem")), oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(datos.wrap, "base64"));
  const temporal = path.join(directorioDatos, ".restore-" + randomUUID());
  const destino = path.join(directorioDatos, "recovered-" + randomUUID());
  await fs.mkdir(temporal, { mode: 0o700 });
  const tar = path.join(temporal, "archive.tar");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(datos.iv, "base64"));
    decipher.setAAD(cabecera); decipher.setAuthTag(tag);
    await pipeline(createReadStream(rutaArchivo, { start: 4 + n, end: stat.size - 17 }), decipher, createWriteStream(tar, { flags: "wx", mode: 0o600 }));
    const salida = path.join(temporal, "profiles");
    await fs.mkdir(salida, { mode: 0o700 });
    const { proceso, fin } = ejecutar(process.env.WHATSAPP_PYTHON || "python3", [path.join(directorioScript, "extract.py"), tar, salida]);
    proceso.stdout.resume(); await fin;
    await fs.rename(salida, destino); await sincronizarDirectorio(directorioDatos);
    console.log(JSON.stringify({ recuperado: destino, perfilesActualesConservados: true }));
  } finally {
    key.fill(0);
    if (path.dirname(temporal) === path.resolve(directorioDatos) && path.basename(temporal).startsWith(".restore-")) await fs.rm(temporal, { recursive: true, force: true });
  }
}
try {
  if (process.argv[2] === "backup") await backup();
  else if (process.argv[2] === "restore") await restore(process.argv[3]);
  else throw new Error("Operación inválida.");
} catch (error) {
  console.error(rootPruebas && error instanceof Error ? error.message : "No se completó la operación de perfiles. Los perfiles actuales se conservan; revisa el disco y la clave de recuperación.");
  process.exitCode = 1;
}
