import { Client } from "pg";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

async function initialize() {
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('gestion-oficina-initialize'))",
  );
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname !~ '^pg_'",
  );
  if (rows[0].n !== 0) {
    throw new Error(
      "La base ya contiene tablas. init-db solo admite una base vacía; no modifica bases existentes.",
    );
  }
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "schema",
  );
  for (const filename of ["001-schema.sql", "004-ajustes-portafolio.sql"]) {
    const sql = fs
      .readFileSync(path.join(directory, filename), "utf8")
      .replace(/^\s*BEGIN\s*;\s*$/gim, "")
      .replace(/^\s*COMMIT\s*;\s*$/gim, "");
    await client.query(sql);
  }
  await client.query("COMMIT");
  console.log(
    "Tablas creadas. La base continúa sin usuarios ni datos de clientes.",
  );
}

async function createAdmin() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (
    !username ||
    !name ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  ) {
    throw new Error(
      "Define BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME y una contraseña de 12 caracteres como mínimo y 72 bytes como máximo.",
    );
  }
  const hash = await bcrypt.hash(password, 10);
  await client.query("BEGIN");
  await client.query("LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE");
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM usuarios",
  );
  if (rows[0].n !== 0) {
    throw new Error(
      "Ya existen usuarios. El primer administrador se crea una sola vez; los siguientes se gestionan desde el panel.",
    );
  }
  await client.query(
    "INSERT INTO usuarios(username,password_hash,nombre_completo,rol,activo,debe_cambiar_contrasena,fecha_creacion) VALUES($1,$2,$3,'administrador',1,1,$4)",
    [username, hash, name, new Date().toISOString()],
  );
  await client.query("COMMIT");
  console.log(
    "Primer administrador creado. Debe cambiar su contraseña al iniciar sesión.",
  );
}

try {
  if (
    !process.env.DATABASE_URL ||
    !["init-db", "create-admin"].includes(command)
  ) {
    throw new Error("Configura DATABASE_URL y usa init-db o create-admin.");
  }
  await client.connect();
  if (command === "init-db") await initialize();
  else await createAdmin();
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  if (error instanceof Error && !Object.hasOwn(error, "code"))
    console.error(error.message);
  else
    console.error(
      "No se pudo preparar la base. Revisa conexión, permisos y disponibilidad; no se muestran credenciales.",
    );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
