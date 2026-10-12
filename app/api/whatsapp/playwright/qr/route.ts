import { NextRequest, NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import { obtenerVinculacionWhatsapp } from "@/lib/whatsapp/playwright";
import { autorizarNumeroVinculacion, validarUsuarioVinculacion, respuestaErrorVinculacion, CABECERAS_VINCULACION } from "@/lib/whatsapp/acceso-vinculacion";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sesion = validarUsuarioVinculacion(await leerSesionActual());
    const acceso = await autorizarNumeroVinculacion(sesion, request.nextUrl.searchParams.get("numero") ?? "");
    const vinculacion = await obtenerVinculacionWhatsapp(acceso.numero);
    await autorizarNumeroVinculacion(sesion, acceso.numero);
    return NextResponse.json({ ok: true, ...vinculacion }, { headers: CABECERAS_VINCULACION });
  } catch (error) {
    return respuestaErrorVinculacion(error);
  }
}
