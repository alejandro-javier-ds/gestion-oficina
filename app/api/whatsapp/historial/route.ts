// app/api/whatsapp/historial/route.ts
//
// Historial de campañas de WhatsApp Masivo.
//
// Crea y consulta campañas y sus destinatarios.

import { NextRequest, NextResponse } from "next/server";

import {
  consultarFilas,
  consultarUno,
  ejecutar,
  conTransaccion,
} from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";
import {
  validarPreparacionWhatsapp,
  ErrorPreparacionWhatsapp,
} from "@/lib/whatsapp/preparacion";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

type CampanaWhatsapp = {
  id: number;
  fecha_creacion: string;
  usuario_creador: string | null;
  campana: string;
  gestor: string | null;
  desde: string;
  hasta: string;
  numero_salida: string;
  total_seleccionados: number;
  total_preparados: number;
  total_sin_telefono: number;
  total_fallidos: number;
  total_enviados: number;
  estado: string;
};

type DestinatarioWhatsapp = {
  id: number;
  idc: string;
  cliente: string | null;
  gestor: string | null;
  telefono_destino: string | null;
  tipo_telefono: string | null;
  estado: string;
  error: string | null;
  fecha_procesamiento: string | null;
  mensaje: string | null;
  duracion_ms: number | null;
  tenor: string | null;
};

function obtenerUsuarioSesion(sesion: {
  nombreCompleto?: string;
  nombre?: string;
  email?: string;
}): string {
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
    const {
      campana,
      gestor,
      desde,
      hasta,
      numeroSalida,
      destinatarios,
      totalSeleccionados,
      totalPreparados,
      totalSinTelefono,
      totalFallidos,
      estado,
    } = validarPreparacionWhatsapp(await request.json());

    const fechaCreacion = new Date().toISOString();

    const campanaId = await conTransaccion(async () => {
      const creada = await consultarUno<{
        id: number;
      }>(
        `
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
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6,
                  $7,
                  $8,
                  $9,
                  $10,
                  $11,
                  0,
                  $12
                )

                RETURNING
                  id::int
                    AS id
              `,
        [
          fechaCreacion,
          obtenerUsuarioSesion(sesion),
          campana,
          gestor || null,
          desde,
          hasta,
          numeroSalida,
          totalSeleccionados,
          totalPreparados,
          totalSinTelefono,
          totalFallidos,
          estado,
        ],
      );

      if (!creada) {
        throw new Error("No se pudo crear la campaña.");
      }

      for (const destinatario of destinatarios) {
        await ejecutar(
          `
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
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6,
                  $7,
                  $8,
                  $9,
                  $10,
                  $11,
                  $12
                )
              `,
          [
            creada.id,

            destinatario.idc,

            destinatario.cliente,

            destinatario.gestor ?? null,

            destinatario.telefonoDestino || null,

            destinatario.tipoTelefono || null,

            destinatario.estado,

            destinatario.error ?? null,

            null,

            destinatario.mensaje ?? null,

            null,

            destinatario.tenor ?? null,
          ],
        );
      }

      return creada.id;
    });

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
    if (
      error instanceof ErrorPreparacionWhatsapp ||
      error instanceof SyntaxError
    ) {
      return NextResponse.json(
        {
          error:
            error instanceof ErrorPreparacionWhatsapp
              ? error.message
              : "El cuerpo de la solicitud no es válido.",
        },
        { status: 400 },
      );
    }
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
    const params = request.nextUrl.searchParams;

    const idParam = params.get("id");

    if (idParam) {
      const id = Number(idParam);

      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
          {
            error: "El ID de la campaña no es válido.",
          },
          {
            status: 400,
          },
        );
      }

      const campana = await consultarUno<CampanaWhatsapp>(
        `
            SELECT
              id::int
                AS id,

              fecha_creacion,
              usuario_creador,
              campana,
              gestor,
              desde,
              hasta,
              numero_salida,

              total_seleccionados::int
                AS total_seleccionados,

              total_preparados::int
                AS total_preparados,

              total_sin_telefono::int
                AS total_sin_telefono,

              total_fallidos::int
                AS total_fallidos,

              total_enviados::int
                AS total_enviados,

              estado

            FROM whatsapp_campanas

            WHERE
              id = $1

            LIMIT 1
          `,
        [id],
      );

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

      const destinatarios = await consultarFilas<DestinatarioWhatsapp>(
        `
            SELECT
              id::int
                AS id,

              idc,
              cliente,
              gestor,
              telefono_destino,
              tipo_telefono,
              estado,
              error,
              fecha_procesamiento,
              mensaje,

              duracion_ms::int
                AS duracion_ms,

              tenor

            FROM whatsapp_campana_destinatarios

            WHERE
              campana_id = $1

            ORDER BY
              id ASC
          `,
        [id],
      );

      return NextResponse.json({
        campana,
        destinatarios,
      });
    }

    const q = params.get("q")?.trim() ?? "";

    const estado = params.get("estado")?.trim() ?? "";

    const condiciones: string[] = ["1 = 1"];

    const valores: unknown[] = [];

    function agregarParametro(valor: unknown): string {
      valores.push(valor);

      return `$${valores.length}`;
    }

    if (q) {
      const parametro = agregarParametro(`%${q}%`);

      condiciones.push(`
        (
          campana ILIKE ${parametro}

          OR COALESCE(
            gestor,
            ''
          ) ILIKE ${parametro}

          OR numero_salida
            ILIKE ${parametro}

          OR COALESCE(
            usuario_creador,
            ''
          ) ILIKE ${parametro}
        )
      `);
    }

    if (estado) {
      const parametro = agregarParametro(estado);

      condiciones.push(`estado = ${parametro}`);
    }

    const campanas = await consultarFilas<CampanaWhatsapp>(
      `
          SELECT
            id::int
              AS id,

            fecha_creacion,
            usuario_creador,
            campana,
            gestor,
            desde,
            hasta,
            numero_salida,

            total_seleccionados::int
              AS total_seleccionados,

            total_preparados::int
              AS total_preparados,

            total_sin_telefono::int
              AS total_sin_telefono,

            total_fallidos::int
              AS total_fallidos,

            total_enviados::int
              AS total_enviados,

            estado

          FROM whatsapp_campanas

          WHERE
            ${condiciones.join(" AND ")}

          ORDER BY
            fecha_creacion DESC,
            id DESC
        `,
      valores,
    );

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
