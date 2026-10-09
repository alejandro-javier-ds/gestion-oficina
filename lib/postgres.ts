// lib/postgres.ts
// Conexión central a PostgreSQL.
//
// Durante la migración convivirá temporalmente con lib/db.ts (SQLite).
// SQLite se retirará únicamente cuando PostgreSQL esté completamente
// migrado y validado.

import { AsyncLocalStorage } from "node:async_hooks";

import { Pool, PoolClient, QueryResult, QueryResultRow, types } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL no está configurada. Revisa el archivo .env.local.",
    );
}

types.setTypeParser(1700, (valor) => Number(valor));

const globalPostgres = globalThis as typeof globalThis & {
    __postgresPool?: Pool;
};

function crearPool(): Pool {
    return new Pool({
        connectionString: databaseUrl,

        max: 10,

        idleTimeoutMillis: 30_000,

        connectionTimeoutMillis: 10_000,

        statement_timeout: 30_000,

        idle_in_transaction_session_timeout: 30_000,
    });
}

const pool = globalPostgres.__postgresPool ?? crearPool();

if (process.env.NODE_ENV !== "production") {
    globalPostgres.__postgresPool = pool;
}

const contextoTransaccion = new AsyncLocalStorage<PoolClient>();

pool.on("error", (error) => {
    console.error(
        "[PostgreSQL] Error inesperado en una conexión inactiva:",
        error,
    );
});

export async function consultar<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parametros: unknown[] = [],
): Promise<QueryResult<T>> {
    const conexion = contextoTransaccion.getStore() ?? pool;

    return conexion.query<T>(sql, parametros);
}

export async function consultarFilas<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parametros: unknown[] = [],
): Promise<T[]> {
    const resultado = await consultar<T>(sql, parametros);

    return resultado.rows;
}

export async function consultarUno<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parametros: unknown[] = [],
): Promise<T | null> {
    const resultado = await consultar<T>(sql, parametros);

    return resultado.rows[0] ?? null;
}

export async function ejecutar(
    sql: string,
    parametros: unknown[] = [],
): Promise<number> {
    const resultado = await consultar(sql, parametros);

    return resultado.rowCount ?? 0;
}
export async function conTransaccion<T>(
    callback: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
    const clienteExistente = contextoTransaccion.getStore();

    if (clienteExistente) {
        return callback(clienteExistente);
    }

    const cliente = await pool.connect();

    try {
        await cliente.query("BEGIN");

        const resultado = await contextoTransaccion.run(cliente, () =>
            callback(cliente),
        );

        await cliente.query("COMMIT");

        return resultado;
    } catch (error) {
        try {
            await cliente.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("[PostgreSQL] Error haciendo ROLLBACK:", rollbackError);
        }

        throw error;
    } finally {
        cliente.release();
    }
}

export default pool;
