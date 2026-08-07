// instrumentation.ts
// Next.js corre la función register() automáticamente 1 sola vez,
// apenas arranca el servidor (tanto en `npm run dev` como en
// producción) — es el lugar correcto para dejar algo corriendo en
// segundo plano todo el tiempo que el servidor esté vivo, como este
// programador de respaldos automáticos.
// Lunes y jueves a las 5:00pm, hora de Lima, sin intervención
// manual — usa la misma lógica que el respaldo manual (lib/backup.ts).

export async function register() {
  // Esto solo debe correr en el entorno de servidor de Node.js —
  // Next.js también llama a register() en otros "runtimes" (Edge),
  // donde node-cron no funcionaría.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const cron = await import('node-cron');
  const { crearRespaldoBaseDatos } = await import('./lib/backup');

  const ZONA_HORARIA = 'America/Lima';

  // Formato cron: minuto hora día-del-mes mes día-de-la-semana
  // (día-de-la-semana: 1 = lunes, 4 = jueves)
  const LUNES_5PM = '0 17 * * 1';
  const JUEVES_5PM = '0 17 * * 4';

  async function ejecutarRespaldoProgramado(etiqueta: string) {
    console.log(`[backup automático] Iniciando respaldo programado (${etiqueta})...`);
    try {
      const { nombre, tamanoMB } = await crearRespaldoBaseDatos();
      console.log(`[backup automático] Respaldo creado: ${nombre} (${tamanoMB} MB)`);
    } catch (error) {
      console.error(`[backup automático] Error al crear el respaldo (${etiqueta}):`, error);
    }
  }

  cron.schedule(LUNES_5PM, () => ejecutarRespaldoProgramado('lunes 5pm'), { timezone: ZONA_HORARIA });
  cron.schedule(JUEVES_5PM, () => ejecutarRespaldoProgramado('jueves 5pm'), { timezone: ZONA_HORARIA });

  console.log('[backup automático] Programador iniciado — respaldos automáticos los lunes y jueves a las 5:00pm (hora de Lima).');
}