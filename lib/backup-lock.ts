import { Client, type QueryResultRow } from "pg";

export type ClienteBloqueoRespaldo = {
  connect(): Promise<unknown>;
  query<T extends QueryResultRow = QueryResultRow>(
    consulta: string,
    valores?: unknown[],
  ): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

export type CrearClienteBloqueoRespaldo = (
  databaseUrl: string,
) => ClienteBloqueoRespaldo;

function crearError(codigo: string, mensaje: string) {
  return Object.assign(new Error(mensaje), { code: codigo });
}

export async function conBloqueoRespaldo<T>(
  databaseUrl: string,
  ejecutar: () => Promise<T>,
  crearCliente: CrearClienteBloqueoRespaldo = (connectionString) =>
    new Client({
      connectionString,
      application_name: "gestion-oficina-backup-lock",
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    }),
): Promise<T> {
  const cliente = crearCliente(databaseUrl);
  let conectado = false;
  let adquirido = false;

  try {
    try {
      await cliente.connect();
      conectado = true;
    } catch {
      throw crearError(
        "BackupLockUnavailable",
        "No se pudo coordinar el respaldo con PostgreSQL.",
      );
    }

    let filas: { adquirido: boolean }[];
    try {
      const resultado = await cliente.query<{ adquirido: boolean }>(
        "SELECT pg_try_advisory_lock($1, $2) AS adquirido",
        [771204, 9],
      );
      filas = resultado.rows;
    } catch {
      throw crearError(
        "BackupLockUnavailable",
        "No se pudo coordinar el respaldo con PostgreSQL.",
      );
    }

    if (!filas[0]?.adquirido) {
      throw crearError(
        "BackupInProgress",
        "Ya hay un respaldo en curso.",
      );
    }

    adquirido = true;
    return await ejecutar();
  } finally {
    if (conectado && adquirido) {
      try {
        await cliente.query("SELECT pg_advisory_unlock($1, $2)", [771204, 9]);
      } catch {
        console.error("[backup] No se pudo confirmar la liberación del bloqueo.", {
          codigo: "BackupLockReleaseFailed",
        });
      }
    }

    if (conectado) {
      try {
        await cliente.end();
      } catch {
        console.error("[backup] No se pudo cerrar la conexión del bloqueo.", {
          codigo: "BackupLockCloseFailed",
        });
      }
    }
  }
}
