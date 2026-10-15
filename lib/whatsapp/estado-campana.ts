export type EstadoFinalCampana =
  | "ENVIADA"
  | "ENVIADA_CON_ERRORES"
  | "REQUIERE_REVISION"
  | "ERROR";

export type ConteoFinalCampana = {
  total: number;
  preparados: number;
  enviados: number;
  errores: number;
  inciertos: number;
  sinTelefono: number;
  pendientes: number;
};

export function determinarEstadoFinalCampana(
  conteo: ConteoFinalCampana,
): EstadoFinalCampana {
  if (conteo.inciertos > 0 || conteo.preparados > 0 || conteo.pendientes > 0) {
    return "REQUIERE_REVISION";
  }

  if (conteo.enviados === conteo.total && conteo.total > 0) {
    return "ENVIADA";
  }

  if (conteo.enviados > 0) {
    return "ENVIADA_CON_ERRORES";
  }

  if (conteo.total > 0 && (conteo.errores > 0 || conteo.sinTelefono > 0)) {
    return "ERROR";
  }

  return "ERROR";
}
