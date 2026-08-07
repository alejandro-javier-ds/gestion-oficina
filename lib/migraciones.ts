// lib/migraciones.ts
// Migraciones automáticas. Agrega columnas nuevas sin borrar datos.
// Se mantiene la migración existente y se agregan los datos monetarios
// originales de cada cuenta provenientes del portafolio.

import Database from "better-sqlite3";

type ColumnaEsperada = { nombre: string; definicion: string };

const COLUMNAS_ESPERADAS: Record<string, ColumnaEsperada[]> = {
  cuentas: [
    { nombre: "provincia", definicion: "TEXT" },
    { nombre: "tipo_juicio", definicion: "TEXT" },
    { nombre: "nro_juicio", definicion: "TEXT" },
    { nombre: "fec_demanda", definicion: "TEXT" },
    { nombre: "supervisor_procesal", definicion: "TEXT" },
    { nombre: "analista_procesal", definicion: "TEXT" },
    { nombre: "fec_entrega_legajo_a_estudio", definicion: "TEXT" },

    { nombre: "codmoneda", definicion: "TEXT" },
    { nombre: "deudatotal_monedaorigen", definicion: "REAL" },
    { nombre: "deudavencida_monedaorigen", definicion: "REAL" },
  ],

  gestiones: [
    { nombre: "moneda_monto_pagado", definicion: "TEXT" },
    { nombre: "idc", definicion: "TEXT" },
    { nombre: "segmentacion", definicion: "TEXT" },
    { nombre: "telefono", definicion: "TEXT" },
  ],

  telefonos: [
    { nombre: "creado_por", definicion: "TEXT" },
    { nombre: "editado_por", definicion: "TEXT" },
    { nombre: "fecha_modificacion", definicion: "TEXT" },
    {
      nombre: "agregado_manualmente",
      definicion: "INTEGER NOT NULL DEFAULT 0",
    },
  ],

  promesas_pago: [
    { nombre: "monto_prometido", definicion: "REAL" },
    { nombre: "modalidad_pago", definicion: "TEXT" },
    { nombre: "observacion", definicion: "TEXT" },
    { nombre: "monto_dolares", definicion: "REAL" },
    { nombre: "tipo_negociacion", definicion: "TEXT" },
    { nombre: "beneficio", definicion: "TEXT" },
    { nombre: "status_pdp", definicion: "TEXT" },
    { nombre: "status_pago", definicion: "TEXT" },
    { nombre: "numero_cuotas_aprobadas", definicion: "INTEGER" },
    { nombre: "estudio", definicion: "TEXT" },
    { nombre: "matriz", definicion: "TEXT" },
  ],

  usuarios: [
    { nombre: "email", definicion: "TEXT" },
    { nombre: "intentos_fallidos", definicion: "INTEGER NOT NULL DEFAULT 0" },
    { nombre: "bloqueado_hasta", definicion: "TEXT" },
  ],
};

export function aplicarMigraciones(db: Database.Database) {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_ESPERADAS)) {
    const tablaExiste = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tabla);

    if (!tablaExiste) continue;

    const columnasActuales = new Set(
      (
        db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[]
      ).map((c) => c.name),
    );

    for (const { nombre, definicion } of columnas) {
      if (!columnasActuales.has(nombre)) {
        db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${definicion}`);
        console.log(
          `[migración] Se agregó la columna "${nombre}" a la tabla "${tabla}".`,
        );
      }
    }
  }
}
