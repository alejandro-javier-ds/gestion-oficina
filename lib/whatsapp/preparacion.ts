import { normalizarCelularWhatsapp } from "./seguimiento";

export type EstadoPreparacion = "PREPARADO" | "SIN_TELEFONO" | "ERROR";

export type DestinatarioPreparado = {
  idc: string;
  cliente: string;
  gestor: string | null;
  telefonoDestino: string;
  tipoTelefono: string;
  estado: EstadoPreparacion;
  error: string | null;
  mensaje: string | null;
  tenor: string | null;
};

export class ErrorPreparacionWhatsapp extends Error {}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new ErrorPreparacionWhatsapp(
      "Los datos de la campaña no son válidos.",
    );
  }
  return valor as Record<string, unknown>;
}

function texto(valor: unknown, campo: string, obligatorio = false): string {
  if (valor == null && !obligatorio) return "";
  if (typeof valor !== "string" || (obligatorio && !valor.trim())) {
    throw new ErrorPreparacionWhatsapp("El campo " + campo + " no es válido.");
  }
  return valor.trim();
}

function textoOpcional(valor: unknown, campo: string): string | null {
  if (valor == null) return null;
  if (typeof valor !== "string") {
    throw new ErrorPreparacionWhatsapp("El campo " + campo + " no es válido.");
  }
  return valor;
}

export function validarPreparacionWhatsapp(entrada: unknown) {
  const body = objeto(entrada);
  for (const campo of ["estado", "totalEnviados", "total_enviados"]) {
    if (Object.hasOwn(body, campo)) {
      throw new ErrorPreparacionWhatsapp(
        "El estado de envío lo registra el servidor.",
      );
    }
  }

  const campana = texto(body.campana, "campana", true);
  const gestor = texto(body.gestor, "gestor");
  const desde = texto(body.desde, "desde", true);
  const hasta = texto(body.hasta, "hasta", true);
  const numeroSalida = normalizarCelularWhatsapp(
    texto(body.numeroSalida, "numeroSalida", true),
  );
  if (
    !numeroSalida ||
    campana.length > 160 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(desde) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(hasta) ||
    desde > hasta
  ) {
    throw new ErrorPreparacionWhatsapp(
      "El remitente o el rango de la campaña no es válido.",
    );
  }

  if (
    !Array.isArray(body.destinatarios) ||
    body.destinatarios.length === 0 ||
    body.destinatarios.length > 5000
  ) {
    throw new ErrorPreparacionWhatsapp("La campaña no tiene destinatarios.");
  }

  const destinatarios: DestinatarioPreparado[] = body.destinatarios.map(
    (entrada) => {
      const fila = objeto(entrada);
      const estado = fila.estado === undefined ? "PREPARADO" : fila.estado;
      if (
        estado !== "PREPARADO" &&
        estado !== "ERROR" &&
        estado !== "SIN_TELEFONO"
      ) {
        throw new ErrorPreparacionWhatsapp(
          "Solo se pueden registrar estados de preparación.",
        );
      }
      for (const campo of [
        "duracionMs",
        "duracion_ms",
        "fechaProcesamiento",
        "fecha_procesamiento",
      ]) {
        if (fila[campo] != null) {
          throw new ErrorPreparacionWhatsapp(
            "La evidencia de procesamiento la registra el servidor.",
          );
        }
      }

      const idc = texto(fila.idc, "idc", true);
      const cliente = texto(fila.cliente, "cliente");
      const telefonoOriginal = texto(fila.telefonoDestino, "telefonoDestino");
      const telefonoDestino =
        normalizarCelularWhatsapp(telefonoOriginal) || telefonoOriginal;
      const tipoTelefono = texto(fila.tipoTelefono, "tipoTelefono");
      const mensaje = textoOpcional(fila.mensaje, "mensaje");
      if (idc.length > 100 || (mensaje?.length ?? 0) > 16_000)
        throw new ErrorPreparacionWhatsapp(
          "El cliente o mensaje excede el límite permitido.",
        );
      const error = textoOpcional(fila.error, "error");

      if (
        estado === "PREPARADO" &&
        (!/^9\d{8}$/.test(telefonoDestino) || !mensaje?.trim())
      ) {
        throw new ErrorPreparacionWhatsapp(
          "Un destinatario preparado debe tener celular válido y mensaje.",
        );
      }

      return {
        idc,
        cliente,
        gestor: texto(fila.gestor, "gestor") || null,
        telefonoDestino,
        tipoTelefono,
        estado,
        error,
        mensaje,
        tenor: textoOpcional(fila.tenor, "tenor"),
      };
    },
  );

  const unicos = new Map<string, DestinatarioPreparado>();
  for (const [indice, fila] of destinatarios.entries()) {
    const clave = fila.telefonoDestino
      ? JSON.stringify([fila.idc, fila.telefonoDestino])
      : String(indice);
    const anterior = unicos.get(clave);
    if (
      anterior &&
      (anterior.mensaje !== fila.mensaje || anterior.estado !== fila.estado)
    )
      throw new ErrorPreparacionWhatsapp(
        "Un teléfono del cliente tiene datos de preparación contradictorios.",
      );
    if (!anterior) unicos.set(clave, fila);
  }
  const destinosUnicos = [...unicos.values()];
  const totales = {
    totalSeleccionados: destinosUnicos.length,
    totalPreparados: destinosUnicos.filter(
      (fila) => fila.estado === "PREPARADO",
    ).length,
    totalSinTelefono: destinosUnicos.filter(
      (fila) => fila.estado === "SIN_TELEFONO",
    ).length,
    totalFallidos: destinosUnicos.filter((fila) => fila.estado === "ERROR")
      .length,
  };
  for (const campo of Object.keys(totales) as Array<keyof typeof totales>) {
    if (body[campo] !== undefined && body[campo] !== totales[campo]) {
      throw new ErrorPreparacionWhatsapp(
        "Los totales de la campaña no coinciden con sus destinatarios.",
      );
    }
  }

  return {
    campana,
    gestor,
    desde,
    hasta,
    numeroSalida,
    destinatarios: destinosUnicos,
    ...totales,
    estado:
      totales.totalFallidos > 0 || totales.totalSinTelefono > 0
        ? "PREPARADA_CON_ERRORES"
        : "PREPARADA",
  };
}
