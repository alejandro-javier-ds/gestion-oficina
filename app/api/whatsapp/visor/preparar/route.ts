import { NextRequest, NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import { iniciarWhatsapp, obtenerEscritorioWhatsapp, existeSesionWhatsapp, obtenerEstadoWhatsapp } from "@/lib/whatsapp/playwright";
import { autorizarNumeroVinculacion, validarUsuarioVinculacion, respuestaErrorVinculacion, CABECERAS_VINCULACION } from "@/lib/whatsapp/acceso-vinculacion";
import { ErrorWhatsapp } from "@/lib/whatsapp/errores";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const sesion = validarUsuarioVinculacion(await leerSesionActual());
    let body: { numero?: unknown; temporal?: unknown } | null;
    try { body = await request.json(); }
    catch { throw new ErrorWhatsapp("CUERPO_INVALIDO", "El cuerpo de la solicitud no es válido.", 400); }
    const acceso = await autorizarNumeroVinculacion(sesion, typeof body?.numero === "string" ? body.numero : "", body?.temporal === true);
    const estado = existeSesionWhatsapp(acceso.numero) ? await obtenerEstadoWhatsapp(acceso.numero)
      : await iniciarWhatsapp(acceso.numero, acceso.temporal, sesion.userId);
    await autorizarNumeroVinculacion(sesion, acceso.numero);
    const escritorio = obtenerEscritorioWhatsapp(acceso.numero);
    if (!escritorio) throw new ErrorWhatsapp("VISOR_NO_HABILITADO", "El visor remoto requiere la imagen Docker con WHATSAPP_REMOTE_VIEWER=1. En el escritorio local, Chromium se abre en su propia ventana.", 409);
    return NextResponse.json({
      ok: true, ...estado,
      conexion: "/api/whatsapp/visor/conexion?numero=" + acceso.numero + "&id=" + escritorio.id,
    }, { headers: CABECERAS_VINCULACION });
  } catch (error) { return respuestaErrorVinculacion(error); }
}
