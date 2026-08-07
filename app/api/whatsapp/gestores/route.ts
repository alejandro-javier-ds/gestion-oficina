// app/api/whatsapp/gestores/route.ts
// Obtiene los gestores disponibles para filtrar la cartera de WhatsApp.
// Administrador y Supervisor pueden consultar todos.
// Un Gestor solo verá su propio nombre.

import { NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import db from "@/lib/db";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

export async function GET() {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar gestores." },
      { status: 403 },
    );
  }

  if (sesion.rol === "gestor") {
    return NextResponse.json({
      gestores: sesion.gestor
        ? [{ id: sesion.gestor, nombre: sesion.gestor }]
        : [],
    });
  }

  const gestores = db
    .prepare(
      `
      SELECT DISTINCT
        gestor AS nombre
      FROM cuentas
      WHERE activo = 1
        AND gestor IS NOT NULL
        AND TRIM(gestor) <> ''
      ORDER BY gestor COLLATE NOCASE
    `,
    )
    .all() as { nombre: string }[];

  return NextResponse.json({
    gestores: gestores.map((gestor) => ({
      id: gestor.nombre,
      nombre: gestor.nombre,
    })),
  });
}
