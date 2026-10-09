// app/api/whatsapp/gestores/route.ts
//
// Obtiene los gestores disponibles
// para filtrar la cartera de WhatsApp.
//
// Administrador y Supervisor:
// pueden consultar todos.
//
// Gestor:
// solo ve su propio nombre.

import { NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

type GestorFila = {
  nombre: string;
};

export async function GET() {
  try {
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
          error: "No tienes permiso para consultar gestores.",
        },
        {
          status: 403,
        },
      );
    }

    if (sesion.rol === "gestor") {
      return NextResponse.json({
        gestores: sesion.gestor
          ? [
            {
              id: sesion.gestor,

              nombre: sesion.gestor,
            },
          ]
          : [],
      });
    }

    const gestores = await consultarFilas<GestorFila>(
      `
          SELECT DISTINCT
            gestor AS nombre

          FROM cuentas

          WHERE
            activo = 1

            AND gestor IS NOT NULL

            AND TRIM(
              gestor
            ) <> ''

          ORDER BY
            nombre ASC
        `,
    );

    return NextResponse.json({
      gestores: gestores.map((gestor) => ({
        id: gestor.nombre,

        nombre: gestor.nombre,
      })),
    });
  } catch (error) {
    console.error("Error consultando gestores WhatsApp:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar los gestores.",
      },
      {
        status: 500,
      },
    );
  }
}
