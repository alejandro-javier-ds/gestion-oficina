// instrumentation.ts
// Punto de entrada de instrumentación de Next.js.
//
// El código exclusivo de Node.js se mantiene separado para evitar que
// Next.js intente analizar dependencias como fs, path, child_process,
// node-cron o el sistema de backups dentro del Edge Runtime.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registrarInstrumentacionNode } =
      await import("./instrumentation.node");

    await registrarInstrumentacionNode();
  }
}
