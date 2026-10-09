import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 4000,
  statement_timeout: 4000,
});

try {
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || 3000}/api/sesion`,
    {
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    },
  );
  if (response.status !== 401) throw new Error("Servidor no disponible");
  await client.connect();
  await client.query("SELECT 1 FROM usuarios LIMIT 1");
} catch {
  console.error("La aplicación o su base de datos no están listas.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
