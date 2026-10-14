const OPCIONES_FECHA_LIMA: Intl.DateTimeFormatOptions = {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

const OPCIONES_FECHA_CORTA: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

const OPCIONES_FECHA_HORA_CORTA: Intl.DateTimeFormatOptions = {
  ...OPCIONES_FECHA_CORTA,
  hour: "2-digit",
  minute: "2-digit",
};

function leerFechaCalendario(valor: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(valor.trim());

  if (!partes) return null;

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return fecha;
}

function serializarFechaCalendario(fecha: Date): string {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function quitarHora(opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  const resultado = { ...opciones };
  delete resultado.hour;
  delete resultado.hour12;
  delete resultado.hourCycle;
  delete resultado.minute;
  delete resultado.second;
  delete resultado.fractionalSecondDigits;
  delete resultado.timeZoneName;
  return resultado;
}

export function sumarDiasCalendario(valor: string, dias: number): string {
  const fecha = leerFechaCalendario(valor);

  if (!fecha || !Number.isInteger(dias)) {
    throw new Error("Fecha calendario o cantidad de días no válidos.");
  }

  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return serializarFechaCalendario(fecha);
}

export function formatearFechaCalendarioLima(
  valor: string | null,
  opciones: Intl.DateTimeFormatOptions = OPCIONES_FECHA_CORTA,
): string {
  if (!valor) return "—";

  const fecha = leerFechaCalendario(valor);

  if (!fecha) return valor;

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    ...opciones,
  }).format(fecha);
}

export function formatearFechaLima(
  valor: string | null,
  opciones: Intl.DateTimeFormatOptions = OPCIONES_FECHA_CORTA,
): string {
  if (!valor) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    return formatearFechaCalendarioLima(valor, quitarHora(opciones));
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    ...opciones,
  }).format(fecha);
}

export function formatearFechaHoraLima(
  valor: string | null,
  opciones: Intl.DateTimeFormatOptions = OPCIONES_FECHA_HORA_CORTA,
): string {
  return formatearFechaLima(valor, opciones);
}

export function fechaActualLima(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", OPCIONES_FECHA_LIMA).formatToParts(fecha);
  const valores = new Map(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.get("year")}-${valores.get("month")}-${valores.get("day")}`;
}

export function inicioMesActualLima(fecha = new Date()): string {
  return `${fechaActualLima(fecha).slice(0, 7)}-01`;
}

export function columnaFechaLimaSql(columna: string): string {
  if (!/^(?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*$/i.test(columna)) {
    throw new Error("Columna de fecha SQL no válida.");
  }
  return `(${columna}::timestamptz AT TIME ZONE 'America/Lima')::date`;
}
