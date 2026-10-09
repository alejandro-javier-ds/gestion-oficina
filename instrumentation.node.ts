// instrumentation.node.ts
// Instrumentación exclusiva para el runtime Node.js.
//
// Aquí vive el programador automático de respaldos

export async function registrarInstrumentacionNode() {
    const cron = await import("node-cron");

    const { crearRespaldoBaseDatos } = await import("./lib/backup");

    const ZONA_HORARIA = "America/Lima";

    const LUNES_5PM = "0 17 * * 1";
    const JUEVES_5PM = "0 17 * * 4";

    async function ejecutarRespaldoProgramado(etiqueta: string) {
        console.log(
            `[backup automático] Iniciando respaldo programado (${etiqueta})...`,
        );

        try {
            const { nombre, tamanoMB } = await crearRespaldoBaseDatos();

            console.log(
                `[backup automático] Respaldo creado: ${nombre} (${tamanoMB} MB)`,
            );
        } catch (error) {
            console.error(
                `[backup automático] Error al crear el respaldo (${etiqueta}):`,
                error,
            );
        }
    }

    cron.schedule(LUNES_5PM, () => ejecutarRespaldoProgramado("lunes 5pm"), {
        timezone: ZONA_HORARIA,
    });

    cron.schedule(JUEVES_5PM, () => ejecutarRespaldoProgramado("jueves 5pm"), {
        timezone: ZONA_HORARIA,
    });

    console.log(
        "[backup automático] Programador iniciado — respaldos automáticos los lunes y jueves a las 5:00pm (hora de Lima).",
    );
}
