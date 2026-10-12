// app/api/sesion/route.ts
// Devuelve los datos básicos de la sesión activa
// El frontend lo usa para decidir qué mostrar, como
// el botón "Panel Admin" o para ocultar acciones sobre la propia cuenta del gestor

import { NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";

const OPCIONES_RESPUESTA_PRIVADA = {
  headers: {
    "Cache-Control": "private, no-store, max-age=0",
  },
};

export async function GET() {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ sesion: null }, OPCIONES_RESPUESTA_PRIVADA);
  }

  return NextResponse.json(
    {
      sesion: {
        userId: sesion.userId,
        nombreCompleto: sesion.nombreCompleto,
        rol: sesion.rol,
      },
    },
    OPCIONES_RESPUESTA_PRIVADA,
  );
}
