// scripts/crear-usuario.ts
// Crea un usuario nuevo con contraseña cifrada. Siempre queda
// marcado para que deba cambiar su contraseña en el primer login.

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const ROLES_VALIDOS = ["administrador", "supervisor", "abogado", "gestor"];

async function main() {
  const { default: db } = await import("../lib/db");
  const { cifrarContrasena } = await import("../lib/auth");

  const [username, contrasena, nombreCompleto, rol, gestor] =
    process.argv.slice(2);

  if (!username || !contrasena || !nombreCompleto || !rol) {
    console.error(
      `Uso: npx tsx scripts/crear-usuario.ts <username> <contraseña> "<nombre completo>" <${ROLES_VALIDOS.join("|")}> [gestor]`,
    );
    process.exit(1);
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    console.error(
      `El rol debe ser exactamente uno de: ${ROLES_VALIDOS.join(", ")}`,
    );
    process.exit(1);
  }

  if (rol === "gestor" && !gestor) {
    console.error(
      'Para un usuario con rol "gestor" debes indicar a qué gestor de la cartera corresponde (el mismo texto exacto que aparece en la columna GESTOR del portafolio).',
    );
    process.exit(1);
  }

  const existente = db
    .prepare("SELECT id FROM usuarios WHERE username = ?")
    .get(username);

  if (existente) {
    console.error(`Ya existe un usuario con username "${username}".`);
    process.exit(1);
  }

  const hash = await cifrarContrasena(contrasena);
  const ahora = new Date().toISOString();

  const resultado = db
    .prepare(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, gestor, rol, debe_cambiar_contrasena, activo, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
    )
    .run(
      username,
      hash,
      nombreCompleto,
      rol === "gestor" ? gestor : null,
      rol,
      ahora,
    );

  console.log("--- Usuario creado correctamente ---");
  console.log("ID:", resultado.lastInsertRowid);
  console.log("Username:", username);
  console.log("Nombre completo:", nombreCompleto);
  console.log("Rol:", rol);
  if (gestor) console.log("Gestor asociado:", gestor);
  console.log("Deberá cambiar su contraseña en el primer inicio de sesión.");
}

main();
