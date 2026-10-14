import { NextResponse } from "next/server";
import { leerSesionActual, type DatosSesion, type Rol } from "@/lib/auth";
import { evaluarAccesoApi } from "@/lib/api-acceso-policy";

type ResultadoAccesoApi =
  | { ok: true; sesion: DatosSesion }
  | { ok: false; respuesta: NextResponse };

function respuesta(status: number, error: string) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    },
  );
}

export async function requerirAccesoApi(
  roles: readonly Rol[],
): Promise<ResultadoAccesoApi> {
  const sesion = await leerSesionActual();
  const error = evaluarAccesoApi(sesion, roles);
  if (error) {
    return {
      ok: false,
      respuesta: respuesta(error.status, error.error),
    };
  }
  if (!sesion) return { ok: false, respuesta: respuesta(401, "No autenticado.") };
  return { ok: true, sesion };
}
