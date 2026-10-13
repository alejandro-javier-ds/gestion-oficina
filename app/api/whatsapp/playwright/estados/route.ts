// app/api/whatsapp/playwright/estados/route.ts
//
// Devuelve el estado de cada número
// de salida registrado.
//
// Estados:
// - conectado
// - no_vinculado
// - desconectado
// - conectando
// - error

import { NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { obtenerEstadoWhatsapp, type EstadoSesionWhatsapp } from "@/lib/whatsapp/playwright";
import { ErrorWhatsapp } from "@/lib/whatsapp/errores";

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

  if (sesion.debeCambiarContrasena || !ROLES_PERMITIDOS.includes(sesion.rol)) {
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
    const filas = await consultarFilas<FilaNumero>(
      `
          SELECT
            id::int
              AS id,

            numero,
            propietario,
            propietario_tipo,

            activo::int
              AS activo,

            principal::int
              AS principal,

            fecha_creacion

          FROM whatsapp_numeros

          WHERE
            activo = 1

          ORDER BY
            principal DESC,
            LOWER(propietario),
            propietario,
            id ASC
        `,
    );

    const numeros = [];

    for (const fila of filas) {
      let estado: EstadoSesionWhatsapp;
      try { estado = await obtenerEstadoWhatsapp(fila.numero, sesion); }
      catch (error) {
        if (!(error instanceof ErrorWhatsapp) || error.status !== 503) throw error;
        estado = { numero: fila.numero, iniciado: false, conectado: false, qrVisible: false, paginaAbierta: false,
          temporal: false, estado: "error", mensaje: "El servicio privado de WhatsApp no está disponible. El número permanece registrado." };
      }

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
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
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
