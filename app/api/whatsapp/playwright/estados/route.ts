// app/api/whatsapp/playwright/estados/route.ts
//
// Devuelve el estado de cada número de salida registrado.
//
// NO inicia Chromium.
// NO envía mensajes.
//
// Estados:
// - conectado
// - no_vinculado
// - desconectado
// - conectando
// - error

import { NextResponse } from "next/server";

import db from "@/lib/db";

import { leerSesionActual } from "@/lib/auth";

import { obtenerEstadoWhatsapp } from "@/lib/whatsapp/playwright";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

type FilaNumero = {
  id: number;
  numero: string;
  propietario: string;
  propietario_tipo: string;
  activo: number;
  principal: number;
  fecha_creacion: string;
};

export async function GET() {
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
        error:
          "Tu rol no tiene permiso para consultar los estados de WhatsApp.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const filas = db
      .prepare(
        `
        SELECT
          id,
          numero,
          propietario,
          propietario_tipo,
          activo,
          principal,
          fecha_creacion
        FROM whatsapp_numeros
        WHERE activo = 1
        ORDER BY
          principal DESC,
          propietario COLLATE NOCASE,
          id ASC
      `,
      )
      .all() as FilaNumero[];

    const numeros = [];

    for (const fila of filas) {
      const estado = await obtenerEstadoWhatsapp(fila.numero);

      numeros.push({
        id: fila.id,

        numero: fila.numero,

        propietario: fila.propietario,

        propietarioTipo: fila.propietario_tipo,

        activo: fila.activo,

        principal: fila.principal,

        fechaCreacion: fila.fecha_creacion,

        iniciado: estado.iniciado,

        conectado: estado.conectado,

        qrVisible: estado.qrVisible,

        paginaAbierta: estado.paginaAbierta,

        temporal: estado.temporal,

        estado: estado.estado,

        mensaje: estado.mensaje,
      });
    }

    return NextResponse.json({
      ok: true,

      total: numeros.length,

      numeros,
    });
  } catch (error) {
    console.error("Error consultando estados WhatsApp:", error);

    return NextResponse.json(
      {
        error: "No se pudieron consultar los estados de WhatsApp.",
      },
      {
        status: 500,
      },
    );
  }
}
