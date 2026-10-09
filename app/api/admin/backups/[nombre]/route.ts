// app/api/admin/backups/[nombre]/route.ts
//
// Descarga un respaldo PostgreSQL específico.
//
// Solo permite archivos válidos existentes
// con formato gestion-oficina_*.dump.
//
// Administrador + Supervisor.

import { NextRequest, NextResponse } from "next/server";

import fs from "fs";
import path from "path";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");

function tieneAcceso(rol: string) {
  return rol === "administrador" || rol === "supervisor";
}

export async function GET(
  request: NextRequest,

  {
    params,
  }: {
    params: Promise<{
      nombre: string;
    }>;
  },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado",
      },
      {
        status: 401,
      },
    );
  }

  if (!tieneAcceso(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene acceso a esto.",
      },
      {
        status: 403,
      },
    );
  }

  const { nombre } = await params;

  const nombresValidos = fs.existsSync(CARPETA_RESPALDOS)
    ? fs
      .readdirSync(CARPETA_RESPALDOS)
      .filter(
        (archivo) =>
          archivo.startsWith("gestion-oficina_") && archivo.endsWith(".dump"),
      )
    : [];

  if (!nombresValidos.includes(nombre)) {
    return NextResponse.json(
      {
        error: "Respaldo no encontrado",
      },
      {
        status: 404,
      },
    );
  }

  const ruta = path.join(CARPETA_RESPALDOS, nombre);

  const buffer = fs.readFileSync(ruta);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",

      "Content-Disposition": `attachment; filename="${nombre}"`,

      "Content-Length": String(buffer.length),
    },
  });
}
