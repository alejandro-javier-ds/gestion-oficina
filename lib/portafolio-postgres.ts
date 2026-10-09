import type { PoolClient } from "pg";

export async function sincronizarSecuenciaHistorial(
  cliente: PoolClient,
): Promise<boolean> {
  await cliente.query(
    "LOCK TABLE historial_router IN SHARE ROW EXCLUSIVE MODE",
  );
  const resultado = await cliente.query<{
    nombre_sql: string;
    incremento: string;
    maximo: string | null;
  }>(
    "SELECT format('%I.%I', n.nspname, c.relname) AS nombre_sql, " +
    "s.seqincrement::text AS incremento, " +
    "(SELECT MAX(id)::text FROM historial_router) AS maximo " +
    "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
    "JOIN pg_sequence s ON s.seqrelid = c.oid " +
    "WHERE c.oid = pg_get_serial_sequence('historial_router', 'id')::regclass",
  );
  const secuencia = resultado.rows[0];
  if (!secuencia)
    throw new Error(
      "historial_router no tiene una secuencia de IDs configurada.",
    );
  if (secuencia.maximo === null) return false;

  const estado = await cliente.query<{ ultimo: string; is_called: boolean }>(
    "SELECT last_value::text AS ultimo, is_called FROM " + secuencia.nombre_sql,
  );
  const incremento = BigInt(secuencia.incremento);
  if (incremento <= BigInt(0))
    throw new Error("La secuencia del historial debe ser ascendente.");
  const ultimo = BigInt(estado.rows[0].ultimo);
  const siguiente =
    ultimo + (estado.rows[0].is_called ? incremento : BigInt(0));
  const maximo = BigInt(secuencia.maximo);
  if (siguiente > maximo) return false;

  await cliente.query(
    "ALTER SEQUENCE " +
    secuencia.nombre_sql +
    " RESTART WITH " +
    (maximo + incremento).toString(),
  );
  return true;
}
