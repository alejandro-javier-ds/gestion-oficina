// app/api/whatsapp/clientes/route.ts
// Obtiene los clientes disponibles para WhatsApp Masivo.
// Este endpoint corresponde exclusivamente a la pestaña Gestiones.
//
// Campañas:
// - sin_contacto
// - acuerdo_pago
// - contactados
// - renuente
// - remate_proceso
// - casos_especiales

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import { SEGMENTACIONES } from "@/lib/catalogo-tipificacion";

type CampanaWhatsApp =
  | "sin_contacto"
  | "acuerdo_pago"
  | "contactados"
  | "renuente"
  | "remate_proceso"
  | "casos_especiales";

type CuentaBase = {
  idc: string;
  cliente: string;
  gestor: string | null;
};

type UltimaGestion = {
  idc: string;
  segmentacion: string | null;
  telefono: string | null;
  fecha_hora: string;
};

type Telefono = {
  id_phone: number;
  idc: string;
  phone: string;
  tipo_telefono: string;
  qtty_phone_ranking: number | null;
  agregado_manualmente: number;
  activo: number;
};

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"] as const;

const SUPERVISORES_SIN_CARTERA = new Set(["Miguel Rodriguez"]);

const SEGMENTACIONES_SIN_CONTACTO = ["NO CONTACTO", "NO CONTACTO - NUEVO"];

const SEGMENTACIONES_ACUERDO = ["ACUERDO DE PAGO"];

const SEGMENTACIONES_CONTACTADOS = [
  "CONTACTO CON NEGOCIACION",
  "CONTACTO SIN NEGOCIACION",
];

const SEGMENTACIONES_RENUENTE = ["RENUENTE"];

const SEGMENTACIONES_REMATE = [
  "REMATADO",
  "CONSIGNACION JUDICIAL",
  "SUSPENSION DE REMATE",
];

const SEGMENTACIONES_ESPECIALES = ["CANCELADO", "FALLECIDO", "NO ASIGNADO"];

function determinarCampana(
  segmentacion: string | null,
): CampanaWhatsApp | null {
  if (!segmentacion) {
    return null;
  }

  if (!SEGMENTACIONES.includes(segmentacion)) {
    return null;
  }

  if (SEGMENTACIONES_SIN_CONTACTO.includes(segmentacion)) {
    return "sin_contacto";
  }

  if (SEGMENTACIONES_ACUERDO.includes(segmentacion)) {
    return "acuerdo_pago";
  }

  if (SEGMENTACIONES_CONTACTADOS.includes(segmentacion)) {
    return "contactados";
  }

  if (SEGMENTACIONES_RENUENTE.includes(segmentacion)) {
    return "renuente";
  }

  if (SEGMENTACIONES_REMATE.includes(segmentacion)) {
    return "remate_proceso";
  }

  if (SEGMENTACIONES_ESPECIALES.includes(segmentacion)) {
    return "casos_especiales";
  }

  return null;
}

function obtenerUltimasGestiones(
  idcs: string[],
  desde: string,
  hasta: string,
): Map<string, UltimaGestion> {
  const resultado = new Map<string, UltimaGestion>();

  const consulta = db.prepare(`
    SELECT
      idc,
      segmentacion,
      telefono,
      fecha_hora
    FROM gestiones
    WHERE idc = ?
      AND date(fecha_hora) BETWEEN ? AND ?
      AND (
        categoria IS NULL
        OR categoria != 'PDP'
      )
    ORDER BY fecha_hora DESC
    LIMIT 1
  `);

  for (const idc of idcs) {
    const gestion = consulta.get(idc, desde, hasta) as
      | UltimaGestion
      | undefined;

    if (gestion) {
      resultado.set(idc, gestion);
    }
  }

  return resultado;
}

function obtenerTelefonos(idcs: string[]): Map<string, Telefono[]> {
  const resultado = new Map<string, Telefono[]>();

  const consulta = db.prepare(`
    SELECT
      id_phone,
      idc,
      phone,
      tipo_telefono,
      qtty_phone_ranking,
      agregado_manualmente,
      activo
    FROM telefonos
    WHERE idc = ?
      AND activo = 1
    ORDER BY
      CASE
        WHEN tipo_telefono = 'celular' THEN 0
        WHEN tipo_telefono = 'fijo' THEN 1
        ELSE 2
      END,
      qtty_phone_ranking DESC,
      agregado_manualmente ASC,
      id_phone ASC
  `);

  for (const idc of idcs) {
    resultado.set(idc, consulta.all(idc) as Telefono[]);
  }

  return resultado;
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    !ROLES_PERMITIDOS.includes(
      sesion.rol as "administrador" | "supervisor" | "gestor",
    )
  ) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para este módulo.",
      },
      {
        status: 403,
      },
    );
  }

  const params = request.nextUrl.searchParams;

  const campanaParam = params.get("campana");

  const vista = params.get("vista") === "todos" ? "todos" : "recientes";

  const busqueda = params.get("q")?.trim().toLowerCase() ?? "";

  const gestorSolicitado = params.get("gestor")?.trim() ?? "";

  const hoy = new Date();

  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const formatearFecha = (fecha: Date) => fecha.toISOString().slice(0, 10);

  const desde = params.get("desde") ?? formatearFecha(primerDiaMes);

  const hasta = params.get("hasta") ?? formatearFecha(hoy);

  const campanasValidas: CampanaWhatsApp[] = [
    "sin_contacto",
    "acuerdo_pago",
    "contactados",
    "renuente",
    "remate_proceso",
    "casos_especiales",
  ];

  if (
    campanaParam &&
    !campanasValidas.includes(campanaParam as CampanaWhatsApp)
  ) {
    return NextResponse.json(
      {
        error: "Campaña inválida.",
      },
      {
        status: 400,
      },
    );
  }

  if (desde > hasta) {
    return NextResponse.json(
      {
        error: "La fecha desde no puede ser posterior a la fecha hasta.",
      },
      {
        status: 400,
      },
    );
  }

  const campana = campanaParam as CampanaWhatsApp | null;

  let gestorFiltro = "";

  if (sesion.rol === "gestor") {
    gestorFiltro = sesion.gestor?.trim() ?? "";
  } else if (
    gestorSolicitado &&
    !SUPERVISORES_SIN_CARTERA.has(gestorSolicitado)
  ) {
    gestorFiltro = gestorSolicitado;
  }

  const restriccionGestor = gestorFiltro ? "AND gestor = ?" : "";

  const parametrosGestor = gestorFiltro ? [gestorFiltro] : [];

  const cuentas = db
    .prepare(
      `
      SELECT
        idc,
        cliente,
        gestor
      FROM cuentas
      WHERE activo = 1
        ${restriccionGestor}
      ORDER BY cliente COLLATE NOCASE
    `,
    )
    .all(...parametrosGestor) as CuentaBase[];

  if (cuentas.length === 0) {
    return NextResponse.json({
      total: 0,
      clientes: [],
      rango: {
        desde,
        hasta,
      },
      vista,
      gestor:
        gestorSolicitado && SUPERVISORES_SIN_CARTERA.has(gestorSolicitado)
          ? gestorSolicitado
          : gestorFiltro || null,
      filtroAplicado: Boolean(gestorFiltro),
    });
  }

  const clientesUnicos = Array.from(
    new Map(cuentas.map((cuenta) => [cuenta.idc, cuenta])).values(),
  );

  const idcs = clientesUnicos.map((cliente) => cliente.idc);

  const ultimasGestiones = obtenerUltimasGestiones(idcs, desde, hasta);

  const idcsGestionados = Array.from(ultimasGestiones.keys());

  if (idcsGestionados.length === 0) {
    return NextResponse.json({
      total: 0,
      clientes: [],
      rango: {
        desde,
        hasta,
      },
      vista,
      gestor:
        gestorSolicitado && SUPERVISORES_SIN_CARTERA.has(gestorSolicitado)
          ? gestorSolicitado
          : gestorFiltro || null,
      filtroAplicado: Boolean(gestorFiltro),
    });
  }

  const telefonos = obtenerTelefonos(idcsGestionados);

  let clientes = clientesUnicos
    .filter((cuenta) => ultimasGestiones.has(cuenta.idc))
    .map((cuenta) => {
      const gestion = ultimasGestiones.get(cuenta.idc)!;

      const campanaCalculada = determinarCampana(gestion.segmentacion);

      return {
        id: cuenta.idc,
        idc: cuenta.idc,
        cliente: cuenta.cliente,
        gestor: cuenta.gestor,
        segmentacion: gestion.segmentacion,
        campana: campanaCalculada,
        ultimaGestion: gestion.fecha_hora,
        telefonoUltimaGestion: gestion.telefono,
        telefonos: telefonos.get(cuenta.idc) ?? [],
        pdp: null,
      };
    })
    .filter((cliente) => {
      if (campana && cliente.campana !== campana) {
        return false;
      }

      if (!busqueda) {
        return true;
      }

      const texto = [
        cliente.idc,
        cliente.cliente,
        cliente.gestor ?? "",
        cliente.segmentacion ?? "",
        cliente.telefonoUltimaGestion ?? "",
        ...cliente.telefonos.map((telefono) => telefono.phone),
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(busqueda);
    })
    .sort(
      (a, b) =>
        new Date(b.ultimaGestion).getTime() -
        new Date(a.ultimaGestion).getTime(),
    );

  const total = clientes.length;

  if (vista === "recientes") {
    clientes = clientes.slice(0, 10);
  }

  return NextResponse.json({
    total,
    clientes,
    rango: {
      desde,
      hasta,
    },
    vista,
    gestor:
      gestorSolicitado && SUPERVISORES_SIN_CARTERA.has(gestorSolicitado)
        ? gestorSolicitado
        : gestorFiltro || null,
    filtroAplicado: Boolean(gestorFiltro),
  });
}
