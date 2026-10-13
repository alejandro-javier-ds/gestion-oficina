import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function comprobarMontaje(mountinfo, root) {
  const montajes = mountinfo.split("\n").filter(Boolean).map((linea) => linea.split(" "));
  const montaje = montajes.find((campos) => campos[4]?.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))) === root);
  if (!montaje || montaje[montaje.indexOf("-") + 1] !== "ext4") throw new Error("El disco persistente ext4 no está montado en /data.");
  for (const campos of montajes) if (campos[4]?.startsWith(root + "/")) throw new Error("No se admiten otros montajes dentro del disco de WhatsApp.");
}

export async function validarDisco(root = "/data", uuid = process.env.WHATSAPP_DATA_UUID) {
  if (process.platform !== "linux" || !uuid || !/^[a-f0-9-]{8,64}$/i.test(uuid)) throw new Error("Falta el UUID verificado del disco de WhatsApp.");
  if (!(await fs.lstat(root)).isDirectory() || await fs.realpath(root) !== root) throw new Error("El disco de WhatsApp no puede ser un enlace.");
  comprobarMontaje(await fs.readFile("/proc/self/mountinfo", "utf8"), root);
  if ((await fs.statfs(root)).type !== 0xef53) throw new Error("El almacenamiento de WhatsApp debe ser ext4.");
  const marcador = path.join(root, ".crm-volume.json");
  const stat = await fs.lstat(marcador);
  if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o222) !== 0) throw new Error("El marcador del disco debe pertenecer a root y ser de solo lectura.");
  if (JSON.parse(await fs.readFile(marcador, "utf8")).uuid !== uuid) throw new Error("El UUID del disco no coincide con la configuración.");
  for (const directorio of ["whatsapp-sessions", "whatsapp-sessions/.temporales"]) {
    const carpeta = path.join(root, directorio);
    const entrada = await fs.lstat(carpeta);
    if (!entrada.isDirectory() || await fs.realpath(carpeta) !== carpeta || (await fs.statfs(carpeta)).type !== 0xef53) throw new Error("La carpeta de perfiles debe estar en el disco ext4.");
    await fs.access(carpeta, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
  }
}

export async function sincronizarDirectorio(carpeta) {
  const archivo = await fs.open(carpeta, "r");
  try { await archivo.sync(); } finally { await archivo.close(); }
}

export async function escribirAtomico(archivo, datos) {
  const temporal = archivo + "." + randomUUID() + ".tmp";
  const handle = await fs.open(temporal, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(datos)); await handle.sync(); }
  finally { await handle.close(); }
  try { await fs.rename(temporal, archivo); await sincronizarDirectorio(path.dirname(archivo)); }
  finally { await fs.unlink(temporal).catch(() => {}); }
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === "check") {
  try { await validarDisco(); }
  catch { console.error("No se inicia WhatsApp: disco ext4, UUID o permisos inválidos."); process.exitCode = 1; }
}
