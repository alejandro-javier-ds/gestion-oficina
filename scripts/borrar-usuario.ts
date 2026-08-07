// scripts/borrar-usuario.ts
// Borra un usuario por su username.

import db from "../lib/db";

const username = process.argv[2];

if (!username) {
  console.error("Uso: npx tsx scripts/borrar-usuario.ts <username>");
  process.exit(1);
}

const resultado = db
  .prepare("DELETE FROM usuarios WHERE username = ?")
  .run(username);

if (resultado.changes === 0) {
  console.log(`No se encontró ningún usuario con username "${username}".`);
} else {
  console.log(`Usuario "${username}" eliminado correctamente.`);
}
