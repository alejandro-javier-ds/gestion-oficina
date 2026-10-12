import { NextRequest, NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import { iniciarWhatsapp } from "@/lib/whatsapp/playwright";
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
    const estado = await iniciarWhatsapp(acceso.numero, acceso.temporal, sesion.userId);
    return NextResponse.json({ ok: true, ...estado }, { headers: CABECERAS_VINCULACION });
  } catch (error) {
    return respuestaErrorVinculacion(error);
  }
}
