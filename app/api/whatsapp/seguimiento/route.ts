import { NextRequest, NextResponse } from "next/server";
import { leerSesionActual } from "@/lib/auth";
import { consultarFilas } from "@/lib/postgres";
import {
  CABECERAS_CAMPANAS,
  ErrorCampanaWhatsapp,
  validarAccesoCampanas,
  cuentasAutorizadasWhatsapp,
  obtenerCampanaAutorizada,
  leerIdCampana,
  agregarSeguimientoWhatsapp,
  DESTINOS_ACTUALES_SQL,
  versionSeleccionWhatsapp,
} from "@/lib/whatsapp/campanas";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const sesion = validarAccesoCampanas(await leerSesionActual());
    const idc = request.nextUrl.searchParams.get("idc")?.trim();
    const campanaId = leerIdCampana(
      request.nextUrl.searchParams.get("campanaId"),
    );
    if (!idc && campanaId) {
      const campana = await obtenerCampanaAutorizada(sesion, campanaId);
      const destinatarios = await consultarFilas(
        `WITH actuales AS (${DESTINOS_ACTUALES_SQL}) SELECT d.* FROM actuales d WHERE d.estado = 'PREPARADO'
        AND EXISTS (SELECT 1 FROM cuentas c WHERE c.idc = d.idc AND c.activo = 1 AND ($2::text IS NULL OR c.gestor = $2)) ORDER BY d.id`,
        [campanaId, sesion.rol === "gestor" ? sesion.gestor : null],
      );
      const idcs = [...new Set(destinatarios.map((d) => String(d.idc)))];
      const cuentas = idcs.length
        ? await cuentasAutorizadasWhatsapp(sesion, idcs)
        : new Map();
      const telefonos = idcs.length
        ? await consultarFilas<{
            idc: string;
            phone: string;
            tipo_telefono: string;
            activo: number;
            id_phone: number;
            agregado_manualmente: number;
            qtty_phone_ranking: number | null;
          }>(
            "SELECT idc, phone, tipo_telefono, activo::int, id_phone::int, agregado_manualmente::int, qtty_phone_ranking FROM telefonos WHERE idc = ANY($1::text[])",
            [idcs],
          )
        : [];
      const clientes = [...cuentas.values()].map((c) => ({
        ...c,
        id: c.idc,
        segmentacion: null,
        campana: null,
        ultimaGestion: campana.fecha_creacion,
        telefonoUltimaGestion: null,
        pdp: null,
        telefonos: telefonos.filter((t) => t.idc === c.idc),
      }));
      return NextResponse.json(
        {
          campana,
          destinatarios,
          versionSeleccion: await versionSeleccionWhatsapp(campanaId),
          clientes: await agregarSeguimientoWhatsapp(
            clientes,
            sesion,
            campanaId,
          ),
        },
        { headers: CABECERAS_CAMPANAS },
      );
    }
    if (!idc || idc.length > 100)
      throw new ErrorCampanaWhatsapp("Indica un cliente válido.");
    await cuentasAutorizadasWhatsapp(sesion, [idc]);
    if (campanaId) await obtenerCampanaAutorizada(sesion, campanaId);
    const pagina = Number(request.nextUrl.searchParams.get("pagina") ?? 1);
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000)
      throw new ErrorCampanaWhatsapp("La página no es válida.");
    const intentos = await consultarFilas(
      `SELECT d.id::int, d.telefono_destino, d.estado, d.error, d.fecha_procesamiento, d.tipo_telefono,
         c.id::int AS campana_id, c.campana, c.numero_salida, c.fecha_creacion, c.estado AS estado_campana
       FROM whatsapp_campana_destinatarios d JOIN whatsapp_campanas c ON c.id = d.campana_id
       WHERE d.idc = $1 AND ($2::int IS NULL OR c.id = $2) ORDER BY d.id DESC LIMIT 51 OFFSET $3`,
      [idc, campanaId, (pagina - 1) * 50],
    );
    return NextResponse.json(
      { intentos: intentos.slice(0, 50), hayMas: intentos.length > 50, pagina },
      { headers: CABECERAS_CAMPANAS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ErrorCampanaWhatsapp
            ? error.message
            : "No se pudo consultar el historial del cliente.",
      },
      {
        status: error instanceof ErrorCampanaWhatsapp ? error.status : 500,
        headers: CABECERAS_CAMPANAS,
      },
    );
  }
}
