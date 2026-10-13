import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import { obtenerEscritorioWhatsapp } from "@/lib/whatsapp/playwright";
import { autorizarNumeroVinculacion, validarUsuarioVinculacion, respuestaErrorVinculacion, CABECERAS_VINCULACION } from "@/lib/whatsapp/acceso-vinculacion";
import { ErrorWhatsapp } from "@/lib/whatsapp/errores";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const secreto = process.env.WHATSAPP_VISOR_INTERNAL_SECRET ?? "";
    const recibido = request.headers.get("x-whatsapp-visor-interno") ?? "";
    if (secreto.length < 32 || Buffer.byteLength(recibido) !== Buffer.byteLength(secreto) ||
      !timingSafeEqual(Buffer.from(recibido), Buffer.from(secreto))) {
      throw new ErrorWhatsapp("VISOR_PRIVADO", "Acceso no permitido.", 403);
    }
    const sesion = validarUsuarioVinculacion(await leerSesionActual());
    const body = await request.json() as { numero?: unknown; id?: unknown };
    const acceso = await autorizarNumeroVinculacion(sesion, typeof body?.numero === "string" ? body.numero : "");
    const escritorio = await obtenerEscritorioWhatsapp(acceso.numero, sesion);
    if (!escritorio || escritorio.id !== body?.id) throw new ErrorWhatsapp("VISOR_CERRADO", "La ventana de WhatsApp ya no está disponible.", 409);
    return NextResponse.json({ ...escritorio, usuarioId: sesion.userId, rol: sesion.rol }, { headers: CABECERAS_VINCULACION });
  } catch (error) { return respuestaErrorVinculacion(error); }
}
