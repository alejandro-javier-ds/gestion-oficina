import { createHash } from "node:crypto";
import type { DatosSesion } from "@/lib/auth";
import {
  consultarFilas,
  consultarUno,
  ejecutar,
  conTransaccion,
} from "@/lib/postgres";
import {
  validarPreparacionWhatsapp,
  type DestinatarioPreparado,
} from "./preparacion";
import {
  normalizarCelularWhatsapp,
  resumirSeguimientoWhatsapp,
  esResultadoInciertoWhatsapp,
  type IntentoWhatsapp,
  type TelefonoSeleccionable,
} from "./seguimiento";

export const CABECERAS_CAMPANAS = {
  "Cache-Control": "private, no-store, max-age=0",
};
const NUMERO_DESTINO_SQL =
  "regexp_replace(COALESCE(d.telefono_destino, ''), '[^0-9]', '', 'g')";
const CLAVE_DESTINO_SQL = `CASE WHEN ${NUMERO_DESTINO_SQL} ~ '^519[0-9]{8}$' THEN RIGHT(${NUMERO_DESTINO_SQL}, 9) ELSE COALESCE(NULLIF(${NUMERO_DESTINO_SQL}, ''), '#' || d.id::text) END`;
export const DESTINOS_ACTUALES_SQL = `SELECT DISTINCT ON (d.idc, ${CLAVE_DESTINO_SQL}) d.*
  FROM whatsapp_campana_destinatarios d WHERE d.campana_id = $1 AND d.estado <> 'EXCLUIDO'
  ORDER BY d.idc, ${CLAVE_DESTINO_SQL}, (d.estado = 'ENVIADO') DESC, d.id DESC`;
export class ErrorCampanaWhatsapp extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type CampanaGuardadaWhatsapp = {
  id: number;
  campana: string;
  estado: string;
  numero_salida: string;
  gestor: string | null;
  desde: string;
  hasta: string;
  fecha_creacion: string;
};
export function validarAccesoCampanas(sesion: DatosSesion | null): DatosSesion {
  if (!sesion) throw new ErrorCampanaWhatsapp("No autenticado.", 401);
  if (
    sesion.debeCambiarContrasena ||
    !["administrador", "supervisor", "gestor"].includes(sesion.rol)
  )
    throw new ErrorCampanaWhatsapp(
      "No tienes permiso para acceder a campañas de WhatsApp.",
      403,
    );
  if (sesion.rol === "gestor" && !sesion.gestor?.trim())
    throw new ErrorCampanaWhatsapp("No tienes una cartera autorizada.", 403);
  return sesion;
}
export function leerIdCampana(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === "") return null;
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ErrorCampanaWhatsapp("El ID de campaña no es válido.");
  return id;
}
export async function cuentasAutorizadasWhatsapp(
  sesion: DatosSesion,
  idcs: string[],
) {
  validarAccesoCampanas(sesion);
  const unicos = [...new Set(idcs)];
  if (!unicos.length || unicos.length > 5000)
    throw new ErrorCampanaWhatsapp("Selecciona entre uno y 5000 clientes.");
  const cuentas = await consultarFilas<{
    idc: string;
    cliente: string;
    gestor: string | null;
  }>(
    "SELECT DISTINCT ON (idc) idc, cliente, gestor FROM cuentas WHERE idc = ANY($1::text[]) AND activo = 1 AND ($2::text IS NULL OR gestor = $2) ORDER BY idc",
    [unicos, sesion.rol === "gestor" ? sesion.gestor : null],
  );
  const mapa = new Map(cuentas.map((c) => [c.idc, c]));
  if (unicos.some((idc) => !mapa.has(idc)))
    throw new ErrorCampanaWhatsapp(
      "Uno de los clientes no pertenece a tu cartera activa.",
      403,
    );
  return mapa;
}
export async function obtenerCampanaAutorizada(
  sesion: DatosSesion,
  id: number,
  modificar = false,
) {
  validarAccesoCampanas(sesion);
  const campana = await consultarUno<CampanaGuardadaWhatsapp>(
    `SELECT id::int, campana, estado, numero_salida, gestor, desde, hasta, fecha_creacion FROM whatsapp_campanas WHERE id = $1 ${modificar ? "FOR UPDATE" : ""}`,
    [id],
  );
  if (!campana) throw new ErrorCampanaWhatsapp("La campaña no existe.", 404);
  if (sesion.rol === "gestor") {
    const acceso = await consultarUno<{ permitido: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM whatsapp_campana_destinatarios d JOIN cuentas c ON c.idc = d.idc AND c.activo = 1 WHERE d.campana_id = $1 AND c.gestor = $2)
        AND ($3::boolean = false OR NOT EXISTS (SELECT 1 FROM whatsapp_campana_destinatarios d WHERE d.campana_id = $1 AND NOT EXISTS (SELECT 1 FROM cuentas c WHERE c.idc = d.idc AND c.activo = 1 AND c.gestor = $2))) AS permitido`,
      [id, sesion.gestor, modificar],
    );
    if (!acceso?.permitido)
      throw new ErrorCampanaWhatsapp(
        "No tienes permiso para esa campaña.",
        403,
      );
  }
  return campana;
}
export async function obtenerIntentosWhatsapp(idcs: string[]) {
  if (!idcs.length) return [];
  return consultarFilas<IntentoWhatsapp>(
    `SELECT d.id::int, d.idc, d.telefono_destino, d.tipo_telefono, d.estado, d.error, d.fecha_procesamiento,
       c.id::int AS campana_id, c.campana, c.numero_salida, c.estado AS estado_campana, c.fecha_creacion
       FROM whatsapp_campana_destinatarios d JOIN whatsapp_campanas c ON c.id = d.campana_id
       WHERE d.idc = ANY($1::text[]) ORDER BY d.id DESC`,
    [idcs],
  );
}
export async function versionSeleccionWhatsapp(campanaId: number) {
  const filas = await consultarFilas(
    "SELECT id::int, idc, telefono_destino, estado, mensaje, tenor FROM whatsapp_campana_destinatarios WHERE campana_id = $1 ORDER BY id",
    [campanaId],
  );
  return createHash("sha256").update(JSON.stringify(filas)).digest("hex");
}
export function validarConfirmacionesWhatsapp(
  filas: IntentoWhatsapp[],
  campanaId: number | null,
  flags: Record<string, unknown>,
) {
  const actuales = filas.filter((h) => h.campana_id === campanaId);
  if (actuales.some((h) => h.estado === "ENVIADO"))
    throw new ErrorCampanaWhatsapp(
      "Ese teléfono ya fue enviado en esta campaña. Utiliza una campaña nueva para un seguimiento.",
      409,
    );
  if (actuales.some((h) => esResultadoInciertoWhatsapp(h.estado, h.error)))
    throw new ErrorCampanaWhatsapp(
      "El resultado de ese teléfono es incierto. Verifica WhatsApp antes de cualquier seguimiento en una campaña nueva.",
      409,
    );
  if (
    actuales.some((h) => h.estado === "ERROR") &&
    flags.confirmarReintentos !== true
  )
    throw new ErrorCampanaWhatsapp(
      "Confirma el reintento de los teléfonos fallidos.",
      409,
    );
  if (
    filas.some((h) => h.campana_id !== campanaId && h.estado === "ENVIADO") &&
    flags.confirmarSeguimientos !== true
  )
    throw new ErrorCampanaWhatsapp(
      "Hay teléfonos con envíos en otras campañas. Actualiza la revisión y confirma el nuevo seguimiento.",
      409,
    );
  const pendientes = filas.filter(
    (h) =>
      h.campana_id !== campanaId &&
      esResultadoInciertoWhatsapp(h.estado, h.error) &&
      !filas.some(
        (e) => e.campana_id === h.campana_id && e.estado === "ENVIADO",
      ),
  );
  if (pendientes.length && flags.confirmarResultadosRevisados !== true)
    throw new ErrorCampanaWhatsapp(
      "Hay resultados anteriores inciertos. Revisa WhatsApp y confirma que no se enviaron antes de iniciar un seguimiento nuevo.",
      409,
    );
}
export async function validarConfirmacionesEnvioWhatsapp(
  campanaId: number,
  destinatarios: { idc: string; telefono_destino: string | null }[],
  flags: Record<string, unknown>,
) {
  const historicos = await obtenerIntentosWhatsapp([
    ...new Set(destinatarios.map((d) => d.idc)),
  ]);
  for (const d of destinatarios)
    validarConfirmacionesWhatsapp(
      historicos.filter(
        (h) =>
          h.idc === d.idc &&
          normalizarCelularWhatsapp(h.telefono_destino) ===
            normalizarCelularWhatsapp(d.telefono_destino),
      ),
      campanaId,
      flags,
    );
}
export async function agregarSeguimientoWhatsapp<
  T extends { idc: string; telefonos: TelefonoSeleccionable[] },
>(clientes: T[], sesion: DatosSesion, campanaId: number | null) {
  const campana = campanaId
    ? await obtenerCampanaAutorizada(sesion, campanaId)
    : null;
  const intentos = await obtenerIntentosWhatsapp([
    ...new Set(clientes.map((c) => c.idc)),
  ]);
  const porCliente = new Map<string, IntentoWhatsapp[]>();
  for (const intento of intentos) {
    const filas = porCliente.get(intento.idc) ?? [];
    filas.push(intento);
    porCliente.set(intento.idc, filas);
  }
  return clientes.map((c) => {
    const seguimiento = resumirSeguimientoWhatsapp(
      c.telefonos,
      porCliente.get(c.idc) ?? [],
      campanaId,
    );
    return {
      ...c,
      seguimiento: {
        ...seguimiento,
        telefonos: seguimiento.telefonos.map((t) => ({
          ...t,
          campana: t.campana ?? campana?.campana ?? null,
          numeroSalida: t.numeroSalida ?? campana?.numero_salida ?? null,
        })),
      },
    };
  });
}
export async function validarDestinosAutorizados(
  sesion: DatosSesion,
  destinatarios: DestinatarioPreparado[],
) {
  const cuentas = await cuentasAutorizadasWhatsapp(
    sesion,
    destinatarios.map((d) => d.idc),
  );
  const telefonos = await consultarFilas<{
    idc: string;
    phone: string;
    tipo_telefono: string;
    activo: number;
  }>(
    "SELECT idc, phone, tipo_telefono, activo::int FROM telefonos WHERE idc = ANY($1::text[])",
    [[...cuentas.keys()]],
  );
  return destinatarios.map((d) => {
    const cuenta = cuentas.get(d.idc)!;
    if (d.estado !== "PREPARADO")
      return { ...d, cliente: cuenta.cliente, gestor: cuenta.gestor };
    const registrados = telefonos.filter(
      (t) =>
        t.idc === d.idc &&
        normalizarCelularWhatsapp(t.phone) === d.telefonoDestino,
    );
    const activo = registrados.find(
      (t) =>
        t.activo === 1 && t.tipo_telefono.trim().toLowerCase() === "celular",
    );
    if (!activo && (d.tipoTelefono !== "manual" || registrados.length))
      throw new ErrorCampanaWhatsapp(
        "Uno de los teléfonos no es un celular activo de ese cliente.",
        403,
      );
    return {
      ...d,
      cliente: cuenta.cliente,
      gestor: cuenta.gestor,
      tipoTelefono: activo?.tipo_telefono ?? "manual",
    };
  });
}
export async function guardarSeleccionCampanaWhatsapp(
  sesion: DatosSesion,
  entrada: unknown,
) {
  validarAccesoCampanas(sesion);
  const body = entrada as Record<string, unknown>;
  const preparacion = validarPreparacionWhatsapp(entrada);
  if (body.seleccionExplicita !== true)
    throw new ErrorCampanaWhatsapp(
      "Actualiza la página y elige explícitamente los teléfonos antes de guardar.",
      409,
    );
  const campanaId = leerIdCampana(body.campanaId);
  return conTransaccion(async () => {
    const destinos = await validarDestinosAutorizados(
      sesion,
      preparacion.destinatarios,
    );
    const existente = campanaId
      ? await obtenerCampanaAutorizada(sesion, campanaId, true)
      : null;
    if (existente?.estado === "ENVIANDO")
      throw new ErrorCampanaWhatsapp(
        "La campaña está enviando. Espera antes de cambiar su selección.",
        409,
      );
    if (
      existente &&
      body.versionSeleccion !== (await versionSeleccionWhatsapp(existente.id))
    )
      throw new ErrorCampanaWhatsapp(
        "La selección cambió en otra ventana. Vuelve a revisarla antes de guardar.",
        409,
      );
    if (
      existente &&
      (existente.numero_salida !== preparacion.numeroSalida ||
        existente.campana !== preparacion.campana)
    )
      throw new ErrorCampanaWhatsapp(
        "Conserva el remitente y el nombre de la campaña guardada.",
        409,
      );
    const historicos = await obtenerIntentosWhatsapp([
      ...new Set(destinos.map((d) => d.idc)),
    ]);
    const nuevos: DestinatarioPreparado[] = [];
    const actualizados: number[] = [];
    for (const destino of destinos) {
      const filas = historicos.filter(
        (h) =>
          h.idc === destino.idc &&
          normalizarCelularWhatsapp(h.telefono_destino) ===
            destino.telefonoDestino,
      );
      const actuales = filas.filter((h) => h.campana_id === campanaId);
      validarConfirmacionesWhatsapp(filas, campanaId, body);
      const preparado = actuales.find(
        (h) => h.estado === "PREPARADO" && !h.fecha_procesamiento,
      );
      if (preparado) {
        await ejecutar(
          "UPDATE whatsapp_campana_destinatarios SET mensaje = $1, tenor = $2 WHERE id = $3 AND estado = 'PREPARADO' AND fecha_procesamiento IS NULL",
          [destino.mensaje, destino.tenor, preparado.id],
        );
        actualizados.push(preparado.id);
        continue;
      }
      nuevos.push(destino);
    }
    const creada =
      existente ??
      (await consultarUno<CampanaGuardadaWhatsapp>(
        `INSERT INTO whatsapp_campanas (fecha_creacion, usuario_creador, campana, gestor, desde, hasta, numero_salida, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PREPARADA') RETURNING id::int, campana, estado, numero_salida, gestor, desde, hasta, fecha_creacion`,
        [
          new Date().toISOString(),
          sesion.nombreCompleto || sesion.username,
          preparacion.campana,
          sesion.rol === "gestor" ? sesion.gestor : preparacion.gestor || null,
          preparacion.desde,
          preparacion.hasta,
          preparacion.numeroSalida,
        ],
      ));
    if (!creada)
      throw new ErrorCampanaWhatsapp("No se pudo guardar la campaña.", 500);
    if (existente)
      await ejecutar(
        "UPDATE whatsapp_campana_destinatarios SET estado = 'EXCLUIDO', error = 'Retirado de la selección antes de enviar.' WHERE campana_id = $1 AND estado = 'PREPARADO' AND fecha_procesamiento IS NULL AND NOT (id = ANY($2::int[]))",
        [creada.id, actualizados],
      );
    for (const d of nuevos)
      await ejecutar(
        `INSERT INTO whatsapp_campana_destinatarios (campana_id, idc, cliente, gestor, telefono_destino, tipo_telefono, estado, error, mensaje, tenor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          creada.id,
          d.idc,
          d.cliente,
          d.gestor,
          d.telefonoDestino || null,
          d.tipoTelefono,
          d.estado,
          d.error,
          d.mensaje,
          d.tenor,
        ],
      );
    await ejecutar(
      `WITH actuales AS (${DESTINOS_ACTUALES_SQL}) UPDATE whatsapp_campanas SET
      total_seleccionados = (SELECT COUNT(*) FROM actuales), total_preparados = (SELECT COUNT(*) FROM actuales WHERE estado = 'PREPARADO'),
      total_sin_telefono = (SELECT COUNT(*) FROM actuales WHERE estado = 'SIN_TELEFONO'), total_fallidos = (SELECT COUNT(*) FROM actuales WHERE estado = 'ERROR'),
      total_enviados = (SELECT COUNT(*) FROM actuales WHERE estado = 'ENVIADO'), estado = $2 WHERE id = $1`,
      [creada.id, preparacion.estado],
    );
    return {
      ok: true,
      id: creada.id,
      estado: preparacion.estado,
      versionSeleccion: await versionSeleccionWhatsapp(creada.id),
    };
  });
}
