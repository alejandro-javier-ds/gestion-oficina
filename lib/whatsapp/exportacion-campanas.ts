export type DestinatarioExportacionCampana = {
  campanaId: number;
  fechaCreacion: string;
  campana: string;
  gestorCampana: string | null;
  gestorAsignado: string | null;
  numeroSalida: string;
  estado: string;
};

export type ResumenExportacionCampana = {
  campanaId: number;
  fechaCreacion: string;
  campana: string;
  gestorCampana: string | null;
  gestoresAsignados: string[];
  numeroSalida: string;
  seleccionados: number;
  preparados: number;
  enviados: number;
  fallidos: number;
  inciertos: number;
  sinTelefono: number;
  enProceso: number;
  excluidos: number;
};

export function resumirCampanasWhatsapp(
  destinatarios: DestinatarioExportacionCampana[],
): ResumenExportacionCampana[] {
  const resumenes = new Map<number, ResumenExportacionCampana & { gestores: Set<string> }>();

  for (const destinatario of destinatarios) {
    let resumen = resumenes.get(destinatario.campanaId);
    if (!resumen) {
      resumen = {
        campanaId: destinatario.campanaId,
        fechaCreacion: destinatario.fechaCreacion,
        campana: destinatario.campana,
        gestorCampana: destinatario.gestorCampana,
        gestoresAsignados: [],
        numeroSalida: destinatario.numeroSalida,
        seleccionados: 0,
        preparados: 0,
        enviados: 0,
        fallidos: 0,
        inciertos: 0,
        sinTelefono: 0,
        enProceso: 0,
        excluidos: 0,
        gestores: new Set(),
      };
      resumenes.set(destinatario.campanaId, resumen);
    }

    const gestor = destinatario.gestorAsignado?.trim();
    if (gestor) resumen.gestores.add(gestor);

    if (destinatario.estado !== "EXCLUIDO") resumen.seleccionados++;
    if (destinatario.estado === "PREPARADO") resumen.preparados++;
    if (destinatario.estado === "ENVIADO") resumen.enviados++;
    if (destinatario.estado === "ERROR") resumen.fallidos++;
    if (destinatario.estado === "INCIERTO") resumen.inciertos++;
    if (destinatario.estado === "SIN_TELEFONO") resumen.sinTelefono++;
    if (destinatario.estado === "ENVIANDO") resumen.enProceso++;
    if (destinatario.estado === "EXCLUIDO") resumen.excluidos++;
  }

  return [...resumenes.values()].map(({ gestores, ...resumen }) => ({
    ...resumen,
    gestoresAsignados: [...gestores].sort((a, b) => a.localeCompare(b, "es")),
  }));
}
