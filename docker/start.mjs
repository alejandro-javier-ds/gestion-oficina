import { spawn } from "node:child_process";
import fs from "node:fs";

const children = new Set();
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
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

function launch(program, args, name) {
  const child = spawn(program, args, { stdio: "inherit", env: process.env });
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

  if (process.env.ENABLE_BROWSER_DESKTOP === "1") {
    const password = process.env.BROWSER_DESKTOP_PASSWORD || "";
    if (!/^[\x21-\x7e]{16,}$/.test(password)) {
      throw new Error(
        "BROWSER_DESKTOP_PASSWORD debe tener al menos 16 caracteres ASCII sin espacios.",
      );
    }
    launch("fluxbox", ["-display", display], "gestor de ventanas");
    launch(
      "x11vnc",
      [
        "-display",
        display,
        "-listen",
        "127.0.0.1",
        "-rfbport",
        "5900",
        "-forever",
        "-shared",
        "-nopw",
      ],
      "visor interno",
    );
    launch(
      "websockify",
      [
        "--web",
        "/usr/share/novnc",
        "--web-auth",
        "--auth-plugin",
        "BasicHTTPAuth",
        "--auth-source",
        `operador:${password}`,
        "0.0.0.0:6080",
        "127.0.0.1:5900",
      ],
      "visor autenticado",
    );
    console.log(
      "Visor opcional de WhatsApp habilitado; requiere autenticación de operador.",
    );
  }

  launch(process.execPath, ["/app/server.js"], "Next.js");
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudo arrancar el contenedor.",
  );
  stop(1);
}
