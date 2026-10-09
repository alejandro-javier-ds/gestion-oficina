// app/api/sesion/route.ts
// Devuelve los datos básicos de la sesión activa
// El frontend lo usa para decidir qué mostrar, como
// el botón "Panel Admin" o para ocultar acciones sobre la propia cuenta del gestor

import { NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";

export async function GET() {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ sesion: null });
  }

  return NextResponse.json({
    sesion: {
      userId: sesion.userId,
      nombreCompleto: sesion.nombreCompleto,
      rol: sesion.rol,
    },
  });
}
