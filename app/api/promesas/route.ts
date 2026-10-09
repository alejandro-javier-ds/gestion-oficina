// app/api/promesas/route.ts
//
// GET:
// Lista promesas de pago.
//
// POST:
// Crea una promesa de pago y su gestión PDP vinculada.
//
// Regla de colaboración:
// los gestores pueden consultar y crear PDP sobre clientes
// asignados a cualquier gestor.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno, conTransaccion } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import {
  TIPOS_PROMESA_PAGO,
  MODALIDADES_PAGO,
  TIPOS_NEGOCIACION,
  BENEFICIOS,
  STATUS_PDP,
  STATUS_PAGO,
  ESTUDIO_FIJO,
  MATRIZ_FIJA,
  TIPO_CAMBIO_REFERENCIAL,
  SEGMENTACION_FIJA_PDP,
} from "@/lib/catalogo-tipificacion";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_REGISTRAR = ["gestor", "supervisor"];

type CuentaPdp = {
  idc: string;
  mtodeuda_sol: number | null;
  codmoneda: string | null;
  deudatotal_monedaorigen: number | null;
  deudavencida_monedaorigen: number | null;
};

type IdInsertado = {
  id: number;
};

function esDolares(valor: string | null | undefined): boolean {
  const normalizado = String(valor ?? "")
    .trim()
    .toUpperCase();

  return (
    normalizado === "DOLARES" ||
    normalizado === "DÓLARES" ||
    normalizado === "USD"
  );
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado",
      },
      {
        status: 401,
      },
    );
  }

  const idc = request.nextUrl.searchParams.get("idc");

  const codcuentacobranza =
    request.nextUrl.searchParams.get("codcuentacobranza");

  if (!idc && !codcuentacobranza) {
    return NextResponse.json(
      {
        error: "Falta el parámetro idc o codcuentacobranza",
      },
      {
        status: 400,
      },
    );
  }

  const promesas = codcuentacobranza
    ? await consultarFilas(
      `
          SELECT *
          FROM promesas_pago
          WHERE codcuentacobranza = $1
          ORDER BY fecha_hora DESC
        `,
      [codcuentacobranza],
    )
    : await consultarFilas(
      `
          SELECT *
          FROM promesas_pago
          WHERE idc = $1
          ORDER BY fecha_hora DESC
        `,
      [idc],
    );

  return NextResponse.json({
    promesas,
  });
}

export async function POST(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado",
      },
      {
        status: 401,
      },
    );
  }

  if (!ROLES_QUE_PUEDEN_REGISTRAR.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para registrar promesas de pago.",
      },
      {
        status: 403,
      },
    );
  }

  const body = await request.json();

  const {
    idc,
    codcuentacobranza,
    tipo,
    moneda,
    fecha_promesa,
    monto_prometido,
    modalidad_pago,
    observacion,
    tipo_negociacion,
    beneficio,
    status_pdp,
    status_pago,
    numero_cuotas_aprobadas,
  } = body;

  if (!idc || !codcuentacobranza || !tipo || !moneda || !fecha_promesa) {
    return NextResponse.json(
      {
        error:
          "Faltan campos obligatorios (idc, codcuentacobranza, tipo, moneda, fecha_promesa)",
      },
      {
        status: 400,
      },
    );
  }

  const tipoValido = TIPOS_PROMESA_PAGO.find((item) => item.codigo === tipo);

  if (!tipoValido) {
    return NextResponse.json(
      {
        error: "Tipo de promesa inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    modalidad_pago &&
    !MODALIDADES_PAGO.find((item) => item.codigo === modalidad_pago)
  ) {
    return NextResponse.json(
      {
        error: "Modalidad de pago inválida",
      },
      {
        status: 400,
      },
    );
  }

  if (tipo_negociacion && !TIPOS_NEGOCIACION.includes(tipo_negociacion)) {
    return NextResponse.json(
      {
        error: "Tipo de negociación inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (beneficio && !BENEFICIOS.includes(beneficio)) {
    return NextResponse.json(
      {
        error: "Beneficio inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (status_pdp && !STATUS_PDP.includes(status_pdp)) {
    return NextResponse.json(
      {
        error: "Status PDP inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (status_pago && !STATUS_PAGO.includes(status_pago)) {
    return NextResponse.json(
      {
        error: "Status de pago inválido",
      },
      {
        status: 400,
      },
    );
  }

  if (
    monto_prometido != null &&
    (typeof monto_prometido !== "number" || monto_prometido < 0)
  ) {
    return NextResponse.json(
      {
        error: "El monto prometido debe ser un número positivo",
      },
      {
        status: 400,
      },
    );
  }

  if (
    numero_cuotas_aprobadas != null &&
    (typeof numero_cuotas_aprobadas !== "number" || numero_cuotas_aprobadas < 0)
  ) {
    return NextResponse.json(
      {
        error: "El número de cuotas debe ser un número positivo",
      },
      {
        status: 400,
      },
    );
  }

  const cuenta = await consultarUno<CuentaPdp>(
    `
      SELECT
        idc,
        mtodeuda_sol,
        codmoneda,
        deudatotal_monedaorigen,
        deudavencida_monedaorigen
      FROM cuentas
      WHERE codcuentacobranza = $1
        AND activo = 1
      LIMIT 1
    `,
    [codcuentacobranza],
  );

  if (!cuenta || cuenta.idc !== idc) {
    return NextResponse.json(
      {
        error: "La cuenta indicada no existe o no pertenece a este cliente",
      },
      {
        status: 400,
      },
    );
  }

  const ahora = new Date().toISOString();

  const modalidadValida = modalidad_pago
    ? MODALIDADES_PAGO.find((item) => item.codigo === modalidad_pago)
    : null;

  const monedaPromesaEsDolares = esDolares(moneda);

  const monedaCuentaEsDolares = esDolares(cuenta.codmoneda);

  const deudaTotalOrigen =
    cuenta.deudatotal_monedaorigen ?? cuenta.mtodeuda_sol ?? null;

  let montoDeudaTotal: number | null = deudaTotalOrigen;

  if (
    deudaTotalOrigen != null &&
    monedaCuentaEsDolares !== monedaPromesaEsDolares
  ) {
    montoDeudaTotal = monedaPromesaEsDolares
      ? Number((deudaTotalOrigen / TIPO_CAMBIO_REFERENCIAL).toFixed(2))
      : Number((deudaTotalOrigen * TIPO_CAMBIO_REFERENCIAL).toFixed(2));
  }

  const montoDolares =
    monto_prometido != null && !monedaPromesaEsDolares
      ? Number((monto_prometido / TIPO_CAMBIO_REFERENCIAL).toFixed(2))
      : null;

  const id = await conTransaccion(async (cliente) => {
    const gestionInsertada = await cliente.query<IdInsertado>(
      `
        INSERT INTO gestiones (
          idc,
          codcuentacobranza,
          usuario_gestor_oficina,
          categoria,
          codigo_razon,
          segmentacion,
          fecha_hora,
          fecha_promesa,
          observacion
        )
        VALUES (
          $1,
          $2,
          $3,
          'PDP',
          $4,
          $5,
          $6,
          $7,
          $8
        )
        RETURNING id::int AS id
      `,
      [
        idc,
        codcuentacobranza,
        sesion.nombreCompleto,
        `${tipoValido.codigo} - ${tipoValido.descripcion}`,
        SEGMENTACION_FIJA_PDP,
        ahora,
        fecha_promesa,
        observacion ?? null,
      ],
    );

    const gestionId = gestionInsertada.rows[0]?.id;

    if (!gestionId) {
      throw new Error("PostgreSQL no devolvió el ID de la gestión PDP.");
    }

    const promesaInsertada = await cliente.query<IdInsertado>(
      `
        INSERT INTO promesas_pago (
          idc,
          codcuentacobranza,
          tipo,
          moneda,
          monto_deuda_total,
          monto_prometido,
          monto_dolares,
          modalidad_pago,
          tipo_negociacion,
          beneficio,
          status_pdp,
          status_pago,
          numero_cuotas_aprobadas,
          estudio,
          matriz,
          observacion,
          fecha_promesa,
          estado,
          usuario_gestor_oficina,
          fecha_hora,
          gestion_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          'vigente',
          $18,
          $19,
          $20
        )
        RETURNING id::int AS id
      `,
      [
        idc,
        codcuentacobranza,
        tipo,
        moneda,
        montoDeudaTotal,
        monto_prometido ?? null,
        montoDolares,

        modalidadValida
          ? `${modalidadValida.codigo} - ${modalidadValida.descripcion}`
          : null,

        tipo_negociacion ?? null,

        beneficio ?? null,

        status_pdp ?? null,

        status_pago ?? "Pendiente",

        numero_cuotas_aprobadas ?? null,

        ESTUDIO_FIJO,
        MATRIZ_FIJA,

        observacion ?? null,

        fecha_promesa,

        sesion.nombreCompleto,
        ahora,
        gestionId,
      ],
    );

    const promesaId = promesaInsertada.rows[0]?.id;

    if (!promesaId) {
      throw new Error("PostgreSQL no devolvió el ID del PDP creado.");
    }

    return promesaId;
  });

  return NextResponse.json({
    ok: true,
    id,
  });
}
