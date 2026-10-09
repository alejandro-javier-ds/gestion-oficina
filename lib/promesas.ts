import {
  MODALIDADES_PAGO,
  TIPO_CAMBIO_REFERENCIAL,
} from "./catalogo-tipificacion";

export function puedeModificarPromesas(rol?: string): boolean {
  return rol === "administrador" || rol === "supervisor";
}

export function construirActualizacionPromesa(
  campos: Record<string, unknown>,
  id: string,
): { sql: string; parametros: unknown[] } | null {
  const asignaciones: string[] = [];
  const parametros: unknown[] = [];
  const referencias: Record<string, string> = {};

  function asignar(campo: string, valor: unknown) {
    parametros.push(valor);
    const referencia = `$${parametros.length}`;
    referencias[campo] = referencia;
    asignaciones.push(`${campo} = ${referencia}`);
  }

  for (const campo of ["estado", "tipo", "moneda", "fecha_promesa"]) {
    if (campos[campo] != null) asignar(campo, campos[campo]);
  }

  for (const campo of [
    "monto_prometido",
    "observacion",
    "numero_cuotas_aprobadas",
  ]) {
    if (campos[campo] !== undefined) asignar(campo, campos[campo]);
  }

  for (const campo of [
    "tipo_negociacion",
    "beneficio",
    "status_pdp",
    "status_pago",
  ]) {
    if (campos[campo] !== undefined) asignar(campo, campos[campo] || null);
  }

  if (campos.modalidad_pago !== undefined) {
    const modalidad = MODALIDADES_PAGO.find(
      (item) => item.codigo === campos.modalidad_pago,
    );
    asignar(
      "modalidad_pago",
      modalidad ? `${modalidad.codigo} - ${modalidad.descripcion}` : null,
    );
  }

  if (referencias.monto_prometido || referencias.moneda) {
    const monto = referencias.monto_prometido ?? "monto_prometido";
    const moneda = referencias.moneda ?? "moneda";
    parametros.push(TIPO_CAMBIO_REFERENCIAL);
    asignaciones.push(`monto_dolares = CASE
      WHEN UPPER(TRIM(${moneda}::text)) IN ('SOLES', 'PEN')
      THEN ROUND(${monto}::numeric / $${parametros.length}::numeric, 2)
      ELSE NULL
    END`);
  }

  if (asignaciones.length === 0) return null;

  parametros.push(id);
  return {
    sql: `UPDATE promesas_pago SET ${asignaciones.join(", ")} WHERE id = $${parametros.length}`,
    parametros,
  };
}
