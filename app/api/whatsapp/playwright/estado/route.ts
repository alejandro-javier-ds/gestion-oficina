import { NextRequest, NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import { consultarFilas } from "@/lib/postgres";
import { obtenerEstadoWhatsapp, obtenerEstadosWhatsapp, obtenerNumerosTemporalesUsuario, obtenerUsuarioSesionTemporal } from "@/lib/whatsapp/playwright";
import { autorizarNumeroVinculacion, validarUsuarioVinculacion, respuestaErrorVinculacion, CABECERAS_VINCULACION } from "@/lib/whatsapp/acceso-vinculacion";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sesion = validarUsuarioVinculacion(await leerSesionActual());
    const numero = request.nextUrl.searchParams.get("numero") ?? "";
    if (!numero) {
      const registrados = await consultarFilas<{ numero: string }>("SELECT numero FROM whatsapp_numeros WHERE activo = 1");
      const candidatos = [...new Set([...registrados.map((fila) => fila.numero), ...await obtenerNumerosTemporalesUsuario(sesion.userId, sesion)])];
      const permitidos: string[] = [];
      for (const candidato of candidatos) {
        try {
          const propietario = await obtenerUsuarioSesionTemporal(candidato, sesion);
          if (propietario !== null && propietario !== sesion.userId) continue;
          await autorizarNumeroVinculacion(sesion, candidato); permitidos.push(candidato);
        }
        catch (error) { if (!(error instanceof Error) || !("status" in error) || error.status !== 403) throw error; }
      }
      return NextResponse.json({ ok: true, sesiones: await obtenerEstadosWhatsapp(permitidos, sesion) }, { headers: CABECERAS_VINCULACION });
    }
    const acceso = await autorizarNumeroVinculacion(sesion, numero);
    return NextResponse.json({ ok: true, ...await obtenerEstadoWhatsapp(acceso.numero, sesion) }, { headers: CABECERAS_VINCULACION });
  } catch (error) {
    return respuestaErrorVinculacion(error);
  }
}
