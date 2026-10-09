// app/api/gestiones/[id]/route.ts
// Editar y eliminar gestiones.
//
// Exclusivo Supervisor + Administrador.

import { NextRequest, NextResponse } from "next/server";

import { consultarUno, ejecutar } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

import { SEGMENTACIONES } from "@/lib/catalogo-tipificacion";

export const runtime = "nodejs";

const ROLES_QUE_PUEDEN_EDITAR = ["supervisor", "administrador"];

type GestionExistente = {
  id: number;
};

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para editar gestiones.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  const body = await request.json();

  const {
    categoria,
    codigo_razon,
    segmentacion,
    monto_pagado,
    moneda_monto_pagado,
    observacion,
  } = body;

  const gestion = await consultarUno<GestionExistente>(
    `
        SELECT id
        FROM gestiones
        WHERE id = $1
        LIMIT 1
      `,
    [id],
  );

  if (!gestion) {
    return NextResponse.json(
      {
        error: "Gestión no encontrada",
      },
      {
        status: 404,
      },
    );
  }

  if (
    segmentacion != null &&
    segmentacion !== "" &&
    !SEGMENTACIONES.includes(segmentacion)
  ) {
    return NextResponse.json(
      {
        error: "La Segmentación debe ser una de las opciones válidas.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    monto_pagado != null &&
    (typeof monto_pagado !== "number" || monto_pagado < 0)
  ) {
    return NextResponse.json(
      {
        error: "El monto pagado debe ser un número positivo",
      },
      {
        status: 400,
      },
    );
  }

  if (
    monto_pagado != null &&
    moneda_monto_pagado != null &&
    !["Soles", "Dolares", "Dólares"].includes(moneda_monto_pagado)
  ) {
    return NextResponse.json(
      {
        error: "Moneda del monto pagado inválida",
      },
      {
        status: 400,
      },
    );
  }

  await ejecutar(
    `
      UPDATE gestiones
      SET
        categoria =
          COALESCE(
            $1,
            categoria
          ),

        codigo_razon =
          COALESCE(
            $2,
            codigo_razon
          ),

        segmentacion =
          COALESCE(
            $3,
            segmentacion
          ),

        monto_pagado =
          $4,

        moneda_monto_pagado =
          CASE
            WHEN $4::numeric IS NULL
              THEN NULL

            ELSE COALESCE(
              $5,
              moneda_monto_pagado,
              'Soles'
            )
          END,

        observacion =
          $6

      WHERE id = $7
    `,
    [
      categoria ?? null,

      codigo_razon ?? null,

      segmentacion || null,

      monto_pagado ?? null,

      moneda_monto_pagado ?? null,

      observacion ?? null,

      id,
    ],
  );

  return NextResponse.json({
    ok: true,
  });
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para eliminar gestiones.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  const gestion = await consultarUno<GestionExistente>(
    `
        SELECT id
        FROM gestiones
        WHERE id = $1
        LIMIT 1
      `,
    [id],
  );

  if (!gestion) {
    return NextResponse.json(
      {
        error: "Gestión no encontrada",
      },
      {
        status: 404,
      },
    );
  }

  await ejecutar(
    `
      DELETE FROM gestiones
      WHERE id = $1
    `,
    [id],
  );

  return NextResponse.json({
    ok: true,
  });
}
