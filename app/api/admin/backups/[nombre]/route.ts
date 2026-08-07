// app/api/admin/backups/[nombre]/route.ts
// Descarga un respaldo específico. Exclusivo Administrador +
// Supervisor. Valida que el nombre solicitado sea exactamente uno
// de los archivos que ya existen en la carpeta de respaldos.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { leerSesionActual } from "@/lib/auth";

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nombre: string }> }) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (sesion.rol !== "administrador" && sesion.rol !== "supervisor") {
    return NextResponse.json(
      { error: "Tu rol no tiene acceso a esto." },
      { status: 403 },
    );
  }

  const { nombre } = await params;

  const nombresValidos = fs.existsSync(CARPETA_RESPALDOS)
    ? fs
      .readdirSync(CARPETA_RESPALDOS)
      .filter((f) => f.startsWith("gestion-oficina_") && f.endsWith(".db"))
    : [];

  if (!nombresValidos.includes(nombre)) {
    return NextResponse.json(
      { error: "Respaldo no encontrado" },
      { status: 404 },
    );
  }

  const ruta = path.join(CARPETA_RESPALDOS, nombre);
  const buffer = fs.readFileSync(ruta);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
