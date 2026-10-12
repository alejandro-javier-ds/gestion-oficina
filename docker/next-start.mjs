let apagando = false;

async function apagar() {
  if (apagando) return;
  apagando = true;
  const limite = setTimeout(() => process.exit(1), 18_000);
  const registro = globalThis.__gestionWhatsapp;
  const abiertas = new Set(registro?.sesiones.values() ?? []);
  await Promise.allSettled(registro?.iniciando.values() ?? []);
  for (const sesion of registro?.sesiones.values() ?? []) abiertas.add(sesion);
  await Promise.allSettled(Array.from(abiertas, async (sesion) => {
    try { await sesion.contexto.close(); }
    finally {
      await sesion.control.liberar();
      await sesion.escritorio?.cerrar();
    }
  }));
  await Promise.allSettled(registro?.cerrando.values() ?? []);
  clearTimeout(limite);
  process.exit(0);
}

process.once("SIGTERM", () => void apagar());
process.once("SIGINT", () => void apagar());

await import("../server.js");
