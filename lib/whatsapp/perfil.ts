import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { ErrorWhatsapp } from "./errores";

const MARCADOR = ".crm-perfil-administrado";

function errorVolumen() {
  return new ErrorWhatsapp("VOLUMEN_WHATSAPP", "El almacenamiento de WhatsApp debe permitir escritura y enlaces simbólicos. Revisa los permisos del volumen y mfsymlinks si utiliza Azure Files SMB.");
}

export function validarMontajePerfil(carpeta: string, montajes: string) {
  const montaje = montajes.split("\n").map((linea) => linea.split(" "))
    .filter((campos) => {
      const destino = campos[1]?.replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
      return destino && (carpeta === destino || carpeta.startsWith(destino.endsWith("/") ? destino : destino + "/"));
    }).sort((a, b) => b[1].length - a[1].length)[0];
  if (montaje?.[2] === "cifs" && montaje[3].split(",").includes("nobrl")) {
    throw new ErrorWhatsapp("BLOQUEO_VOLUMEN_WHATSAPP", "El volumen de WhatsApp tiene nobrl y no permite proteger el perfil entre contenedores. Revisa las opciones del montaje de Azure Files.");
  }
}

async function tomarBloqueo(carpeta: string) {
  const archivo = path.join(carpeta, ".crm-chromium.lock");
  const existente = await fs.lstat(archivo).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (existente && !existente.isFile()) throw errorVolumen();
  const proceso = spawn("flock", ["--exclusive", "--nonblock", "--no-fork", archivo,
    process.execPath, "-e", "process.stdout.write('LISTO\\n');process.stdin.resume();process.stdin.on('end',()=>process.exit(0));"],
  { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  proceso.stdin.on("error", () => {});
  let liberado = false;
  let perdido: (() => void) | undefined;
  const terminado = new Promise<void>((resolve) => proceso.once("close", () => {
    if (!liberado) perdido?.();
    resolve();
  }));
  await new Promise<void>((resolve, reject) => {
    const temporizador = setTimeout(() => {
      liberado = true;
      proceso.kill("SIGKILL");
      reject(new ErrorWhatsapp("BLOQUEO_WHATSAPP", "No se pudo comprobar el bloqueo del perfil de WhatsApp."));
    }, 5000);
    proceso.once("error", () => {
      clearTimeout(temporizador);
      reject(new ErrorWhatsapp("BLOQUEO_WHATSAPP", "No está disponible la herramienta de bloqueo del perfil de WhatsApp."));
    });
    proceso.once("exit", () => {
      clearTimeout(temporizador);
      reject(new ErrorWhatsapp("PERFIL_OCUPADO", "Otra instancia está utilizando este perfil de WhatsApp. Intenta nuevamente cuando termine.", 409));
    });
    proceso.stdout.once("data", (datos: Buffer) => {
      clearTimeout(temporizador);
      if (datos.toString().trim() === "LISTO") resolve();
      else reject(new ErrorWhatsapp("BLOQUEO_WHATSAPP", "No se pudo comprobar el bloqueo del perfil de WhatsApp."));
    });
  });
  return {
    alPerderBloqueo(callback: () => void) {
      perdido = callback;
      if (proceso.exitCode !== null || proceso.signalCode !== null) callback();
    },
    async liberar() {
      if (liberado) return;
      liberado = true;
      proceso.stdin.end();
      const temporizador = setTimeout(() => proceso.kill("SIGKILL"), 2000);
      await terminado;
      clearTimeout(temporizador);
    },
  };
}

async function limpiarBloqueosObsoletos(carpeta: string) {
  const bloqueo = path.join(carpeta, "SingletonLock");
  const destino = await fs.readlink(bloqueo).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw new ErrorWhatsapp("PERFIL_OCUPADO", "El bloqueo existente del perfil requiere revisión; se conserva sin cambios.", 409);
  });
  if (!destino) return;
  const propietario = /^(.*)-(\d+)$/.exec(destino);
  if (!propietario) throw new ErrorWhatsapp("PERFIL_OCUPADO", "El perfil tiene un bloqueo que no se puede recuperar de forma segura.", 409);
  if (propietario[1] === os.hostname()) {
    try {
      process.kill(Number(propietario[2]), 0);
      throw new ErrorWhatsapp("PERFIL_OCUPADO", "Chromium ya está utilizando este perfil de WhatsApp.", 409);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  } else {
    const administrado = await fs.readFile(path.join(carpeta, MARCADOR), "utf8").catch(() => "");
    if (administrado !== "flock-v1") throw new ErrorWhatsapp("PERFIL_OCUPADO", "El perfil conserva un bloqueo de una instancia anterior. Verifica que esa instancia haya terminado; no se eliminó el perfil.", 409);
  }
  for (const nombre of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    const archivo = path.join(carpeta, nombre);
    const entrada = await fs.lstat(archivo).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (entrada && !entrada.isSymbolicLink()) throw new ErrorWhatsapp("PERFIL_OCUPADO", "El perfil contiene un bloqueo inesperado; se conserva sin cambios.", 409);
  }
  for (const nombre of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    await fs.unlink(path.join(carpeta, nombre)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export async function prepararPerfilWhatsapp(carpeta: string) {
  let control: Awaited<ReturnType<typeof tomarBloqueo>> | undefined;
  let prueba: string | undefined;
  try {
    await fs.mkdir(carpeta, { recursive: true });
    if (process.env.WHATSAPP_SERVICE === "1" && (await fs.realpath(carpeta) !== path.resolve(carpeta) || (await fs.statfs(carpeta)).type !== 0xef53)) {
      throw new ErrorWhatsapp("PERFIL_EXT4", "El perfil de WhatsApp debe estar directamente en el disco ext4, sin enlaces a otro almacenamiento.");
    }
    await fs.access(carpeta, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    if (process.platform === "linux") {
      validarMontajePerfil(carpeta, await fs.readFile("/proc/mounts", "utf8"));
      control = await tomarBloqueo(carpeta);
      prueba = path.join(carpeta, `.crm-prueba-${randomUUID()}`);
      await fs.mkdir(prueba);
      const archivo = path.join(prueba, "archivo");
      const enlace = path.join(prueba, "enlace");
      await fs.writeFile(archivo, "prueba", { flag: "wx", mode: 0o600 });
      await fs.symlink("archivo", enlace);
      if (await fs.readlink(enlace) !== "archivo" || await fs.readFile(enlace, "utf8") !== "prueba") throw errorVolumen();
      await limpiarBloqueosObsoletos(carpeta);
    }
    return {
      async marcarAdministrado() {
        if (control) await fs.writeFile(path.join(carpeta, MARCADOR), "flock-v1", { mode: 0o600 });
      },
      alPerderBloqueo(callback: () => void) { control?.alPerderBloqueo(callback); },
      async liberar() { await control?.liberar(); },
    };
  } catch (error) {
    await control?.liberar();
    if (error instanceof ErrorWhatsapp) throw error;
    throw errorVolumen();
  } finally {
    if (prueba && path.dirname(prueba) === path.resolve(carpeta) && path.basename(prueba).startsWith(".crm-prueba-")) {
      await fs.rm(prueba, { recursive: true, force: true });
    }
  }
}
