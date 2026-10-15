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

function leerInstante(valor: string): Date | null {
  const texto = valor.trim();
  const conZona = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(texto);
  if (conZona) {
    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const partes = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/.exec(texto);
  if (!partes) return null;

  const [, anioTexto, mesTexto, diaTexto, horaTexto, minutoTexto, segundoTexto = "0", milisegundoTexto = "0"] = partes;
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  const segundo = Number(segundoTexto);
  const milisegundo = Number(milisegundoTexto.padEnd(3, "0"));
  const calendario = leerFechaCalendario(`${anioTexto}-${mesTexto}-${diaTexto}`);

  if (!calendario || hora > 23 || minuto > 59 || segundo > 59) return null;

  return new Date(Date.UTC(anio, mes - 1, dia, hora + 5, minuto, segundo, milisegundo));
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

  const fecha = leerInstante(valor);

  if (!fecha) return valor;

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

export function fechaHoraLimaAInstante(valor: string | null): Date | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return leerFechaCalendario(valor);
  return leerInstante(valor);
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
  const texto = `(${columna})::text`;
  const fechaConZona = "^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+)?)?([Zz]|[+-][0-9]{2}(:?[0-9]{2})?)$";
  return `(CASE WHEN ${texto} ~ '${fechaConZona}' THEN (${columna}::timestamptz AT TIME ZONE 'America/Lima') ELSE ${columna}::timestamp END)::date`;
}
