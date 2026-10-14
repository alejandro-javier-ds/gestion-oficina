export type TelefonoSeleccionable = {
  phone: string;
  tipo_telefono: string;
  activo: number;
};
export type IntentoWhatsapp = {
  id: number;
  idc: string;
  telefono_destino: string | null;
  tipo_telefono: string | null;
  estado: string;
  error: string | null;
  fecha_procesamiento: string | null;
  campana_id: number;
  campana: string;
  numero_salida: string;
  estado_campana: string;
  fecha_creacion: string;
};
export type EstadoTelefonoWhatsapp =
  | "ENVIADO"
  | "PENDIENTE"
  | "FALLIDO"
  | "EN_PROCESO"
  | "INCIERTO";
export type FiltroSeguimientoWhatsapp =
  | "TODOS"
  | "COMPLETADO"
  | "PARCIAL"
  | "PENDIENTE"
  | "REVISAR"
  | "SIN_EXITO";
export type SeguimientoTelefono = {
  numero: string;
  manual: boolean;
  estado: EstadoTelefonoWhatsapp;
  fechaUltimoIntento: string | null;
  campanaId: number | null;
  campana: string | null;
  numeroSalida: string | null;
  detalle: string | null;
  enviosAnteriores: number;
  resultadosAnterioresInciertos: boolean;
  requiereReintento: boolean;
  ultimoEnvioAnterior: {
    campanaId: number;
    fecha: string | null;
    numeroSalida: string;
  } | null;
};
export type SeguimientoCliente = {
  campanaId: number | null;
  estado: "COMPLETADO" | "PARCIAL" | "PENDIENTE" | "REVISAR";
  total: number;
  enviados: number;
  pendientes: number;
  fallidos: number;
  enProceso: number;
  telefonos: SeguimientoTelefono[];
};
export function normalizarCelularWhatsapp(valor: unknown): string {
  if (typeof valor !== "string" || !/^[+\d\s()-]+$/.test(valor)) return "";
  const limpio = valor.replace(/\D/g, "");
  const numero =
    limpio.length === 11 && limpio.startsWith("51") ? limpio.slice(2) : limpio;
  return /^9\d{8}$/.test(numero) ? numero : "";
}
export function celularesActivosWhatsapp<T extends TelefonoSeleccionable>(
  telefonos: T[],
): (T & { phone: string })[] {
  const unicos = new Map<string, T & { phone: string }>();
  for (const telefono of telefonos) {
    const numero = normalizarCelularWhatsapp(telefono.phone);
    if (
      telefono.activo === 1 &&
      telefono.tipo_telefono.trim().toLowerCase() === "celular" &&
      numero &&
      !unicos.has(numero)
    ) {
      unicos.set(numero, { ...telefono, phone: numero });
    }
  }
  return [...unicos.values()];
}
export function esResultadoInciertoWhatsapp(
  estado: string,
  detalle?: string | null,
) {
  return (
    estado === "ENVIANDO" ||
    estado === "INCIERTO" ||
    /(?:no (?:reintentar|confirm[oó]|confirmado)|incierto|no confirmado|sin confirmaci[oó]n)/i.test(
      detalle ?? "",
    )
  );
}
export function resumirSeguimientoWhatsapp(
  telefonos: TelefonoSeleccionable[],
  intentos: IntentoWhatsapp[],
  campanaId: number | null,
): SeguimientoCliente {
  const numeros = new Map(
    celularesActivosWhatsapp(telefonos).map((t) => [t.phone, false]),
  );
  for (const intento of intentos) {
    const numero = normalizarCelularWhatsapp(intento.telefono_destino);
    if (
      numero &&
      intento.campana_id === campanaId &&
      intento.estado !== "EXCLUIDO" &&
      intento.tipo_telefono === "manual" &&
      !numeros.has(numero)
    )
      numeros.set(numero, true);
  }
  const detalles: SeguimientoTelefono[] = [...numeros].map(
    ([numero, manual]) => {
      const filas = intentos.filter(
        (i) => normalizarCelularWhatsapp(i.telefono_destino) === numero,
      );
      const actuales = filas
        .filter((i) => i.campana_id === campanaId && i.estado !== "EXCLUIDO")
        .sort((a, b) => b.id - a.id);
      const ultimo = actuales[0];
      const enviado = actuales.find((i) => i.estado === "ENVIADO");
      const anteriores = filas
        .filter((i) => i.campana_id !== campanaId && i.estado === "ENVIADO")
        .sort((a, b) => b.id - a.id);
      const previo = anteriores[0];
      let estado: EstadoTelefonoWhatsapp = "PENDIENTE";
      if (enviado) estado = "ENVIADO";
      else if (
        ultimo?.estado === "ENVIANDO" &&
        ultimo.estado_campana === "ENVIANDO" &&
        ultimo.fecha_procesamiento &&
        Date.now() - Date.parse(ultimo.fecha_procesamiento) < 120_000
      )
        estado = "EN_PROCESO";
      else if (
        ultimo &&
        esResultadoInciertoWhatsapp(ultimo.estado, ultimo.error)
      )
        estado = "INCIERTO";
      else if (ultimo?.estado === "ERROR" || ultimo?.estado === "SIN_TELEFONO")
        estado = "FALLIDO";
      return {
        numero,
        manual,
        estado,
        fechaUltimoIntento: ultimo?.fecha_procesamiento ?? null,
        campanaId: ultimo?.campana_id ?? campanaId,
        campana: ultimo?.campana ?? null,
        numeroSalida: ultimo?.numero_salida ?? null,
        detalle: ultimo?.error ?? null,
        resultadosAnterioresInciertos: filas.some(
          (i) =>
            i.campana_id !== campanaId &&
            esResultadoInciertoWhatsapp(i.estado, i.error) &&
            !filas.some(
              (enviado) =>
                enviado.campana_id === i.campana_id &&
                enviado.estado === "ENVIADO",
            ),
        ),
        requiereReintento:
          !enviado &&
          actuales.some(
            (i) =>
              i.estado === "ERROR" &&
              !esResultadoInciertoWhatsapp(i.estado, i.error),
          ),
        enviosAnteriores: anteriores.length,
        ultimoEnvioAnterior: previo
          ? {
              campanaId: previo.campana_id,
              fecha: previo.fecha_procesamiento,
              numeroSalida: previo.numero_salida,
            }
          : null,
      };
    },
  );
  const enviados = detalles.filter((t) => t.estado === "ENVIADO").length;
  const fallidos = detalles.filter(
    (t) => t.estado === "FALLIDO" || t.estado === "INCIERTO",
  ).length;
  const enProceso = detalles.filter((t) => t.estado === "EN_PROCESO").length;
  const estado = fallidos
    ? "REVISAR"
    : detalles.length > 0 && enviados === detalles.length
      ? "COMPLETADO"
      : enviados > 0
        ? "PARCIAL"
        : "PENDIENTE";
  return {
    campanaId,
    estado,
    total: detalles.length,
    enviados,
    pendientes: detalles.length - enviados,
    fallidos,
    enProceso,
    telefonos: detalles,
  };
}
export function coincideFiltroSeguimiento(
  seguimiento: SeguimientoCliente,
  filtro: string,
) {
  return (
    filtro === "TODOS" ||
    (filtro === "SIN_EXITO"
      ? seguimiento.pendientes > 0
      : seguimiento.estado === filtro)
  );
}
export function destinosElegidosWhatsapp(
  cliente: {
    telefonos: TelefonoSeleccionable[];
    seguimiento?: SeguimientoCliente;
  },
  seleccionados: string[],
  manuales: string[],
) {
  if (seleccionados.some((n) => !normalizarCelularWhatsapp(n)))
    throw new Error("Uno de los teléfonos seleccionados no es válido.");
  const registrados = new Map(
    celularesActivosWhatsapp(cliente.telefonos).map((t) => [t.phone, t]),
  );
  const extras = new Set([
    ...manuales,
    ...(cliente.seguimiento?.telefonos
      .filter((t) => t.manual)
      .map((t) => t.numero) ?? []),
  ]);
  return [
    ...new Set(seleccionados.map(normalizarCelularWhatsapp).filter(Boolean)),
  ].map((numero) => {
    const registrado = registrados.get(numero);
    if (!registrado && !extras.has(numero))
      throw new Error(
        "Uno de los teléfonos seleccionados ya no está activo o no pertenece al cliente.",
      );
    const estado = cliente.seguimiento?.telefonos.find(
      (t) => t.numero === numero,
    )?.estado;
    if (
      estado === "ENVIADO" ||
      estado === "EN_PROCESO" ||
      estado === "INCIERTO"
    )
      throw new Error(
        "Ese teléfono ya fue enviado, está en proceso o requiere verificar un resultado incierto.",
      );
    return { numero, tipoTelefono: registrado?.tipo_telefono ?? "manual" };
  });
}
