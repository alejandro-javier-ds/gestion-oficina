import fs from "node:fs/promises";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { ErrorWhatsapp } from "./errores";

export type EscritorioWhatsapp = {
  id: string;
  puerto: number;
  display: string;
  alCerrar: (callback: () => void) => void;
  cerrar: () => Promise<void>;
};

export function visorRemotoHabilitado() {
  return process.platform === "linux" && process.env.WHATSAPP_REMOTE_VIEWER === "1";
}

async function puertoLibre() {
  const servidor = net.createServer();
  await new Promise<void>((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  const puerto = (servidor.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
  return puerto;
}

export async function abrirEscritorioWhatsapp(): Promise<EscritorioWhatsapp | null> {
  if (!visorRemotoHabilitado()) return null;
  const procesos: ChildProcess[] = [];
  let cerrado = false;
  let fallo = false;
  let alCerrar: (() => void) | undefined;
  let cierre: Promise<void> | undefined;
  function vigilar(proceso: ChildProcess) {
    procesos.push(proceso);
    const terminar = () => {
      if (!cerrado) { fallo = true; alCerrar?.(); }
    };
    proceso.once("error", terminar);
    proceso.once("exit", terminar);
    return proceso;
  }
  function cerrar() {
    if (cierre) return cierre;
    cerrado = true;
    cierre = Promise.all(procesos.reverse().map(async (proceso) => {
      if (proceso.exitCode !== null || proceso.signalCode !== null) return;
      const fin = new Promise<void>((resolve) => proceso.once("close", resolve));
      proceso.kill("SIGTERM");
      const corte = setTimeout(() => proceso.kill("SIGKILL"), 2000);
      await fin;
      clearTimeout(corte);
    })).then(() => {});
    return cierre;
  }
  try {
    const pantalla = vigilar(spawn("Xvfb", ["-displayfd", "3", "-screen", "0", "1600x1000x24", "-nolisten", "tcp", "-ac"],
      { stdio: ["ignore", "ignore", "ignore", "pipe"], windowsHide: true }));
    const canal = pantalla.stdio[3] as NodeJS.ReadableStream;
    const display = await new Promise<string>((resolve, reject) => {
      let leido = "";
      const corte = setTimeout(() => reject(new Error("Pantalla no disponible")), 10_000);
      const fallar = () => { clearTimeout(corte); reject(new Error("Pantalla no disponible")); };
      pantalla.once("error", fallar);
      pantalla.once("exit", fallar);
      canal.on("data", (datos: Buffer) => {
        leido += datos.toString();
        if (!leido.includes("\n")) return;
        clearTimeout(corte);
        const numero = leido.trim();
        if (/^\d{1,5}$/.test(numero)) resolve(":" + numero);
        else reject(new Error("Pantalla no disponible"));
      });
    });
    const limite = Date.now() + 10_000;
    while (!(await fs.stat("/tmp/.X11-unix/X" + display.slice(1)).catch(() => null))) {
      if (fallo || Date.now() > limite) throw new Error("Pantalla no disponible");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const puerto = await puertoLibre();
    vigilar(spawn("x11vnc", ["-display", display, "-listen", "127.0.0.1", "-rfbport", String(puerto),
      "-no6", "-forever", "-shared", "-nopw", "-nosel", "-noclipboard", "-noprimary",
      "-desktop", "WhatsApp del CRM", "-quiet"],
    { stdio: "ignore", windowsHide: true }));
    let listo = false;
    const limiteVnc = Date.now() + 10_000;
    while (!listo && !fallo && Date.now() < limiteVnc) {
      listo = await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: "127.0.0.1", port: puerto });
        socket.setTimeout(500);
        const terminar = (ok: boolean) => { socket.destroy(); resolve(ok); };
        socket.once("connect", () => terminar(true));
        socket.once("error", () => terminar(false));
        socket.once("timeout", () => terminar(false));
      });
      if (!listo) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!listo || fallo) throw new Error("Visor no disponible");
    return {
      id: randomUUID(), display, puerto,
      alCerrar(callback) { alCerrar = callback; if (fallo) callback(); },
      cerrar,
    };
  } catch {
    await cerrar();
    throw new ErrorWhatsapp("VISOR_NO_DISPONIBLE", "No se pudo preparar la pantalla privada de WhatsApp. Revisa Xvfb y x11vnc; el perfil se conserva.");
  }
}
