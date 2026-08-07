// lib/db.ts
// Punto único de conexión a SQLite.
// Crea las tablas base y ejecuta las migraciones existentes.

import Database from "better-sqlite3";
import path from "path";

import {
  CREATE_CUENTAS,
  CREATE_INDICE_IDC,
  CREATE_GESTIONES,
  CREATE_INDICE_GESTIONES_IDC,
  CREATE_TELEFONOS,
  CREATE_GARANTIAS,
  CREATE_INDICE_GARANTIAS_IDC,
  CREATE_APERSONAMIENTO,
  CREATE_INDICE_APERSONAMIENTO_IDC,
  CREATE_PROMESAS_PAGO,
  CREATE_INDICE_PROMESAS_IDC,
  CREATE_CITAS,
  CREATE_INDICE_CITAS_IDC,
  CREATE_HISTORIAL_ROUTER,
  CREATE_INDICE_HISTORIAL_ROUTER_IDC,
  CREATE_DIRECCIONES,
  CREATE_INDICE_DIRECCIONES_IDC,
  CREATE_IMPORTS,
  CREATE_USUARIOS,
  CREATE_EXPORTACIONES,
} from "./schema";

import { aplicarMigraciones } from "./migraciones";

const dbPath = path.join(process.cwd(), "data", "db", "gestion_oficina.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(CREATE_CUENTAS);

db.exec(CREATE_INDICE_IDC);

db.exec(CREATE_GESTIONES);

db.exec(CREATE_INDICE_GESTIONES_IDC);

db.exec(CREATE_TELEFONOS);

db.exec(CREATE_GARANTIAS);

db.exec(CREATE_INDICE_GARANTIAS_IDC);

db.exec(CREATE_APERSONAMIENTO);

db.exec(CREATE_INDICE_APERSONAMIENTO_IDC);

db.exec(CREATE_PROMESAS_PAGO);

db.exec(CREATE_INDICE_PROMESAS_IDC);

db.exec(CREATE_CITAS);

db.exec(CREATE_INDICE_CITAS_IDC);

db.exec(CREATE_HISTORIAL_ROUTER);

db.exec(CREATE_INDICE_HISTORIAL_ROUTER_IDC);

db.exec(CREATE_DIRECCIONES);

db.exec(CREATE_INDICE_DIRECCIONES_IDC);

db.exec(CREATE_IMPORTS);

db.exec(CREATE_USUARIOS);

db.exec(CREATE_EXPORTACIONES);

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_numeros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    propietario TEXT NOT NULL,
    propietario_tipo TEXT NOT NULL DEFAULT 'gestor',
    activo INTEGER NOT NULL DEFAULT 1,
    principal INTEGER NOT NULL DEFAULT 0,
    fecha_creacion TEXT NOT NULL
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_whatsapp_numeros_activo
  ON whatsapp_numeros(activo);
`);

aplicarMigraciones(db);

export default db;
