// app/api/whatsapp/historial/route.ts
//
// Historial de campañas de WhatsApp Masivo.
//
// Crea y consulta campañas y sus destinatarios.

import { NextRequest, NextResponse } from "next/server";

import db from "@/lib/db";

import { leerSesionActual } from "@/lib/auth";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

function inicializarTablas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_campanas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_creacion TEXT NOT NULL,
      usuario_creador TEXT,
      campana TEXT NOT NULL,
      gestor TEXT,
      desde TEXT NOT NULL,
      hasta TEXT NOT NULL,
      numero_salida TEXT NOT NULL,
      total_seleccionados INTEGER NOT NULL DEFAULT 0,
      total_preparados INTEGER NOT NULL DEFAULT 0,
      total_sin_telefono INTEGER NOT NULL DEFAULT 0,
      total_fallidos INTEGER NOT NULL DEFAULT 0,
      total_enviados INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'PREPARADA'
    );

    CREATE TABLE IF NOT EXISTS whatsapp_campana_destinatarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana_id INTEGER NOT NULL,
      idc TEXT NOT NULL,
      cliente TEXT,
      gestor TEXT,
      telefono_destino TEXT,
      tipo_telefono TEXT,
      estado TEXT NOT NULL DEFAULT 'PREPARADO',
      error TEXT,
      fecha_procesamiento TEXT,
      FOREIGN KEY (campana_id)
        REFERENCES whatsapp_campanas(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_campanas_fecha
      ON whatsapp_campanas(fecha_creacion);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_campanas_estado
      ON whatsapp_campanas(estado);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_destinatarios_campana
      ON whatsapp_campana_destinatarios(campana_id);

    CREATE INDEX IF NOT EXISTS idx_whatsapp_destinatarios_idc
      ON whatsapp_campana_destinatarios(idc);
  `);

  try {
    db.exec(`
      ALTER TABLE whatsapp_campana_destinatarios
      ADD COLUMN mensaje TEXT
    `);
  } catch { }

  try {
    db.exec(`
      ALTER TABLE whatsapp_campana_destinatarios
      ADD COLUMN duracion_ms INTEGER
    `);
  } catch { }

  try {
    db.exec(`
      ALTER TABLE whatsapp_campana_destinatarios
      ADD COLUMN tenor TEXT
    `);
  } catch { }
}

function obtenerUsuarioSesion(sesion: {
  nombreCompleto?: string;
  nombre?: string;
  email?: string;
}) {
  return sesion.nombreCompleto ?? sesion.nombre ?? sesion.email ?? "Usuario";
}

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "No tienes permiso para crear campañas.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    inicializarTablas();

    const body = await request.json();

    const {
      campana,
      gestor,
      desde,
      hasta,
      numeroSalida,
      totalSeleccionados,
      totalPreparados,
      totalSinTelefono,
      totalFallidos,
      destinatarios,
    } = body as {
      campana: string;

      gestor?: string;

      desde: string;

      hasta: string;

      numeroSalida: string;

      totalSeleccionados: number;

      totalPreparados: number;

      totalSinTelefono: number;

      totalFallidos: number;

      destinatarios: {
        idc: string;

        cliente: string;

        gestor?: string | null;

        telefonoDestino: string;

        tipoTelefono: string;

        estado: string;

        error?: string | null;

        mensaje?: string | null;

        duracionMs?: number | null;

        tenor?: string | null;
      }[];
    };

    if (!campana || !desde || !hasta || !numeroSalida) {
      return NextResponse.json(
        {
          error: "Faltan datos obligatorios de la campaña.",
        },
        {
          status: 400,
        },
      );
    }

    if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
      return NextResponse.json(
        {
          error: "La campaña no tiene destinatarios.",
        },
        {
          status: 400,
        },
      );
    }

    const fechaCreacion = new Date().toISOString();

    const estado =
      totalFallidos > 0 || totalSinTelefono > 0
        ? "PREPARADA_CON_ERRORES"
        : "PREPARADA";

    const insertarCampana = db.prepare(`
        INSERT INTO whatsapp_campanas (
          fecha_creacion,
          usuario_creador,
          campana,
          gestor,
          desde,
          hasta,
          numero_salida,
          total_seleccionados,
          total_preparados,
          total_sin_telefono,
          total_fallidos,
          total_enviados,
          estado
        )
        VALUES (
          @fecha_creacion,
          @usuario_creador,
          @campana,
          @gestor,
          @desde,
          @hasta,
          @numero_salida,
          @total_seleccionados,
          @total_preparados,
          @total_sin_telefono,
          @total_fallidos,
          0,
          @estado
        )
      `);

    const insertarDestinatario = db.prepare(`
        INSERT INTO whatsapp_campana_destinatarios (
          campana_id,
          idc,
          cliente,
          gestor,
          telefono_destino,
          tipo_telefono,
          estado,
          error,
          fecha_procesamiento,
          mensaje,
          duracion_ms,
          tenor
        )
        VALUES (
          @campana_id,
          @idc,
          @cliente,
          @gestor,
          @telefono_destino,
          @tipo_telefono,
          @estado,
          @error,
          @fecha_procesamiento,
          @mensaje,
          @duracion_ms,
          @tenor
        )
      `);

    const crearCampana = db.transaction(() => {
      const resultado = insertarCampana.run({
        fecha_creacion: fechaCreacion,

        usuario_creador: obtenerUsuarioSesion(sesion),

        campana,

        gestor: gestor?.trim() || null,

        desde,

        hasta,

        numero_salida: numeroSalida,

        total_seleccionados: totalSeleccionados,

        total_preparados: totalPreparados,

        total_sin_telefono: totalSinTelefono,

        total_fallidos: totalFallidos,

        estado,
      });

      const campanaId = Number(resultado.lastInsertRowid);

      for (const destinatario of destinatarios) {
        insertarDestinatario.run({
          campana_id: campanaId,

          idc: destinatario.idc,

          cliente: destinatario.cliente,

          gestor: destinatario.gestor ?? null,

          telefono_destino: destinatario.telefonoDestino || null,

          tipo_telefono: destinatario.tipoTelefono || null,

          estado: destinatario.estado || "PREPARADO",

          error: destinatario.error ?? null,

          fecha_procesamiento: fechaCreacion,

          mensaje: destinatario.mensaje ?? null,

          duracion_ms: destinatario.duracionMs ?? null,

          tenor: destinatario.tenor ?? null,
        });
      }

      return campanaId;
    });

    const campanaId = crearCampana();

    return NextResponse.json(
      {
        ok: true,

        id: campanaId,

        estado,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Error creando historial WhatsApp:", error);

    return NextResponse.json(
      {
        error: "No se pudo guardar la campaña.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "No tienes permiso para consultar el historial.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    inicializarTablas();

    const params = request.nextUrl.searchParams;

    const id = params.get("id");

    if (id) {
      const campana = db
        .prepare(
          `
          SELECT
            id,
            fecha_creacion,
            usuario_creador,
            campana,
            gestor,
            desde,
            hasta,
            numero_salida,
            total_seleccionados,
            total_preparados,
            total_sin_telefono,
            total_fallidos,
            total_enviados,
            estado
          FROM whatsapp_campanas
          WHERE id = ?
          LIMIT 1
        `,
        )
        .get(Number(id));

      if (!campana) {
        return NextResponse.json(
          {
            error: "Campaña no encontrada.",
          },
          {
            status: 404,
          },
        );
      }

      const destinatarios = db
        .prepare(
          `
          SELECT
            id,
            idc,
            cliente,
            gestor,
            telefono_destino,
            tipo_telefono,
            estado,
            error,
            fecha_procesamiento,
            mensaje,
            duracion_ms,
            tenor
          FROM whatsapp_campana_destinatarios
          WHERE campana_id = ?
          ORDER BY id ASC
        `,
        )
        .all(Number(id));

      return NextResponse.json({
        campana,
        destinatarios,
      });
    }

    const q = params.get("q")?.trim() ?? "";

    const estado = params.get("estado")?.trim() ?? "";

    let sql = `
      SELECT
        id,
        fecha_creacion,
        usuario_creador,
        campana,
        gestor,
        desde,
        hasta,
        numero_salida,
        total_seleccionados,
        total_preparados,
        total_sin_telefono,
        total_fallidos,
        total_enviados,
        estado
      FROM whatsapp_campanas
      WHERE 1 = 1
    `;

    const valores: string[] = [];

    if (q) {
      sql += `
        AND (
          campana LIKE ?
          OR gestor LIKE ?
          OR numero_salida LIKE ?
          OR usuario_creador LIKE ?
        )
      `;

      const busqueda = `%${q}%`;

      valores.push(busqueda, busqueda, busqueda, busqueda);
    }

    if (estado) {
      sql += `
        AND estado = ?
      `;

      valores.push(estado);
    }

    sql += `
      ORDER BY fecha_creacion DESC
    `;

    const campanas = db.prepare(sql).all(...valores);

    return NextResponse.json({
      campanas,
    });
  } catch (error) {
    console.error("Error consultando historial WhatsApp:", error);

    return NextResponse.json(
      {
        error: "No se pudo consultar el historial.",
      },
      {
        status: 500,
      },
    );
  }
}
