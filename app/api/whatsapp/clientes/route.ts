// app/api/whatsapp/clientes/route.ts
//
// Obtiene los clientes disponibles para WhatsApp Masivo.
// Pestaña Gestiones.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { SEGMENTACIONES } from "@/lib/catalogo-tipificacion";

import {
  agregarSeguimientoWhatsapp,
  leerIdCampana,
  ErrorCampanaWhatsapp,
  CABECERAS_CAMPANAS,
} from "@/lib/whatsapp/campanas";
import { coincideFiltroSeguimiento } from "@/lib/whatsapp/seguimiento";
import { fechaActualLima, inicioMesActualLima } from "@/lib/fecha-lima";
export const runtime = "nodejs";

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

async function obtenerUltimasGestiones(
  idcs: string[],
  desde: string,
  hasta: string,
): Promise<Map<string, UltimaGestion>> {
  const resultado = new Map<string, UltimaGestion>();

  if (idcs.length === 0) {
    return resultado;
  }

  const filas = await consultarFilas<UltimaGestion>(
    `
        SELECT DISTINCT ON (
          idc
        )
          idc,
          segmentacion,
          telefono,
          fecha_hora

        FROM gestiones

        WHERE
          idc = ANY(
            $1::text[]
          )

          AND LEFT(
            fecha_hora::text,
            10
          ) BETWEEN $2 AND $3

          AND (
            categoria IS NULL
            OR
            categoria <> 'PDP'
          )

        ORDER BY
          idc,
          fecha_hora DESC
      `,
    [idcs, desde, hasta],
  );

  for (const fila of filas) {
    resultado.set(fila.idc, fila);
  }

  return resultado;
}

async function obtenerTelefonos(
  idcs: string[],
): Promise<Map<string, Telefono[]>> {
  const resultado = new Map<string, Telefono[]>();

  for (const idc of idcs) {
    resultado.set(idc, []);
  }

  if (idcs.length === 0) {
    return resultado;
  }

  const filas = await consultarFilas<Telefono>(
    `
        SELECT
          id_phone::int
            AS id_phone,

          idc,
          phone,
          tipo_telefono,
          qtty_phone_ranking,
          agregado_manualmente,
          activo

        FROM telefonos

        WHERE
          idc = ANY(
            $1::text[]
          )

          AND activo = 1

        ORDER BY
          idc,

          CASE
            WHEN tipo_telefono = 'celular'
              THEN 0

            WHEN tipo_telefono = 'fijo'
              THEN 1

            ELSE 2
          END,

          qtty_phone_ranking DESC,
          agregado_manualmente ASC,
          id_phone ASC
      `,
    [idcs],
  );

  for (const telefono of filas) {
    const actuales = resultado.get(telefono.idc) ?? [];

    actuales.push(telefono);

    resultado.set(telefono.idc, actuales);
  }

  return resultado;
}

export async function GET(request: NextRequest) {
  try {
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

    if (
      sesion.debeCambiarContrasena ||
      (sesion.rol === "gestor" && !sesion.gestor?.trim())
    ) {
      return NextResponse.json(
        { error: "No tienes una sesión autorizada para consultar clientes." },
        { status: 403, headers: CABECERAS_CAMPANAS },
      );
    }
    const params = request.nextUrl.searchParams;

    const campanaParam = params.get("campana");

    const vista = params.get("vista") === "todos" ? "todos" : "recientes";

    const busqueda = params.get("q")?.trim().toLowerCase() ?? "";

    const gestorSolicitado = params.get("gestor")?.trim() ?? "";

    const desde = params.get("desde") ?? inicioMesActualLima();

    const hasta = params.get("hasta") ?? fechaActualLima();

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

    const parametrosCuentas: unknown[] = [];

    let restriccionGestor = "";

    if (gestorFiltro) {
      parametrosCuentas.push(gestorFiltro);

      restriccionGestor = `
        AND gestor = $1
      `;
    }

    const cuentas = await consultarFilas<CuentaBase>(
      `
        SELECT
          idc,
          cliente,
          gestor

        FROM cuentas

        WHERE
          activo = 1

          ${restriccionGestor}

        ORDER BY
          LOWER(
            cliente
          ),
          cliente
      `,
      parametrosCuentas,
    );

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

    const ultimasGestiones = await obtenerUltimasGestiones(idcs, desde, hasta);

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

    const telefonos = await obtenerTelefonos(idcsGestionados);

    const clientes = clientesUnicos
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

    const campanaId = leerIdCampana(params.get("campanaId"));
    const filtroSeguimiento = params.get("seguimiento") ?? "TODOS";
    const seguidos = await agregarSeguimientoWhatsapp(
      clientes,
      sesion,
      campanaId,
    );
    let clientesSeguidos = seguidos.filter((c) =>
      coincideFiltroSeguimiento(c.seguimiento, filtroSeguimiento),
    );
    const total = clientesSeguidos.length;

    if (vista === "recientes") {
      clientesSeguidos = clientesSeguidos.slice(0, 10);
    }

    return NextResponse.json(
      {
        total,
        clientes: clientesSeguidos,

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
      },
      { headers: CABECERAS_CAMPANAS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ErrorCampanaWhatsapp
            ? error.message
            : "No se pudieron cargar los clientes.",
      },
      {
        status: error instanceof ErrorCampanaWhatsapp ? error.status : 500,
        headers: CABECERAS_CAMPANAS,
      },
    );
  }
}
