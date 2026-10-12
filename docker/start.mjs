import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { crearGateway } from "./gateway.mjs";

const children = new Set();
let stopping = false;
let gateway;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  void gateway?.cerrar().catch(() => {});
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 20_000);
  timer.unref();
  Promise.all(
    [...children].map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) resolve();
          else child.once("exit", resolve);
        }),
    ),
  ).then(() => process.exit(code));
}

function launch(program, args, name, env = process.env) {
  const child = spawn(program, args, { stdio: "inherit", env });
  children.add(child);
  child.once("error", () => {
    console.error(`No se pudo iniciar ${name}.`);
    stop(1);
  });
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} terminó; se detiene el contenedor.`);
      stop(code || 1);
    }
  });
  return child;
}

process.once("SIGTERM", () => stop(0));
process.once("SIGINT", () => stop(0));

try {
  const display = process.env.DISPLAY || ":99";
  if (!/^:\d+$/.test(display)) throw new Error("DISPLAY no es válido");
  process.env.DISPLAY = display;
  const socket = `/tmp/.X11-unix/X${display.slice(1)}`;
  launch(
    "Xvfb",
    [display, "-screen", "0", "1440x900x24", "-nolisten", "tcp", "-ac"],
    "pantalla virtual",
  );
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(socket)) {
    if (stopping || Date.now() >= deadline)
      throw new Error("Pantalla virtual no disponible");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const reserva = net.createServer();
  await new Promise((resolve, reject) => {
    reserva.once("error", reject);
    reserva.listen(0, "127.0.0.1", resolve);
  });
  const puertoNext = reserva.address().port;
  await new Promise((resolve) => reserva.close(resolve));
  const secreto = randomBytes(32).toString("hex");
  process.env.WHATSAPP_VISOR_INTERNAL_SECRET = secreto;
  gateway = crearGateway({ puertoNext, secreto, origen: process.env.CRM_PUBLIC_ORIGIN });
  launch(process.execPath, ["/app/docker/next-start.mjs"], "Next.js", {
    ...process.env, PORT: String(puertoNext), HOSTNAME: "127.0.0.1", NEXT_MANUAL_SIG_HANDLE: "true",
  });
  await new Promise((resolve, reject) => {
    gateway.servidor.once("error", reject);
    gateway.servidor.listen(Number(process.env.PORT || 3000), process.env.HOSTNAME || "0.0.0.0", resolve);
  });
  console.log("CRM iniciado con visor de WhatsApp protegido por el mismo ingreso HTTP.");
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudo arrancar el contenedor.",
  );
  stop(1);
}
