// app/api/whatsapp/numeros/route.ts
//
// Gestiona los números desde los cuales
// se pueden preparar campañas de WhatsApp.
//
// GET  -> números registrados y activos.
// POST -> registrar o reactivar un número.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas, consultarUno } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

type PropietarioTipo = "gestor" | "supervisor" | "independiente";

type NumeroWhatsapp = {
  id: number;
  numero: string;
  propietario: string;
  propietarioTipo: PropietarioTipo;
  activo: number;
  principal: number;
  fechaCreacion: string;
};

type FilaNumeroWhatsapp = {
  id: number;
  numero: string;
  propietario: string;
  propietario_tipo: string;
  activo: number;
  principal: number;
  fecha_creacion: string;
};

type NumeroExistente = {
  id: number;
  activo: number;
};

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

const PROPIETARIOS: Array<{
  nombre: string;
  tipo: PropietarioTipo;
}> = [
    {
      nombre: "Geraldine Salazar",
      tipo: "gestor",
    },
    {
      nombre: "Glycel Lozada",
      tipo: "gestor",
    },
    {
      nombre: "Gonzalo Barrientos",
      tipo: "gestor",
    },
    {
      nombre: "Miguel Rodriguez",
      tipo: "supervisor",
    },
    {
      nombre: "Independiente",
      tipo: "independiente",
    },
  ];

function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, "").replace(/^51/, "");
}

function esCelularPeruano(numero: string): boolean {
  return /^9\d{8}$/.test(numero);
}

function serializarNumero(fila: FilaNumeroWhatsapp): NumeroWhatsapp {
  let propietarioTipo: PropietarioTipo = "gestor";

  if (fila.propietario_tipo === "supervisor") {
    propietarioTipo = "supervisor";
  }

  if (fila.propietario_tipo === "independiente") {
    propietarioTipo = "independiente";
  }

  return {
    id: fila.id,

    numero: fila.numero,

    propietario: fila.propietario,

    propietarioTipo,

    activo: fila.activo,

    principal: fila.principal,

    fechaCreacion: fila.fecha_creacion,
  };
}

export async function GET() {
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

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para este módulo.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const filas = await consultarFilas<FilaNumeroWhatsapp>(
      `
          SELECT
            id::int
              AS id,

            numero,
            propietario,
            propietario_tipo,

            activo::int
              AS activo,

            principal::int
              AS principal,

            fecha_creacion

          FROM whatsapp_numeros

          WHERE
            activo = 1

          ORDER BY
            principal DESC,

            LOWER(
              propietario
            ),

            propietario,

            id ASC
        `,
    );

    return NextResponse.json({
      numeros: filas.map(serializarNumero),
    });
  } catch (error) {
    console.error("Error consultando números de WhatsApp:", error);

    return NextResponse.json(
      {
        error: "No se pudieron consultar los números de WhatsApp.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
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

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para este módulo.",
      },
      {
        status: 403,
      },
    );
  }

  let body: {
    numero?: unknown;
    propietario?: unknown;
    principal?: unknown;
  };

  try {
    body = (await request.json()) as {
      numero?: unknown;
      propietario?: unknown;
      principal?: unknown;
    };
  } catch {
    return NextResponse.json(
      {
        error: "El cuerpo de la solicitud no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  const numero =
    typeof body.numero === "string" ? normalizarNumero(body.numero) : "";

  const propietario =
    typeof body.propietario === "string" ? body.propietario.trim() : "";

  const principal = body.principal === true ? 1 : 0;

  if (!esCelularPeruano(numero)) {
    return NextResponse.json(
      {
        error: "Ingresa un celular peruano válido de 9 dígitos.",
      },
      {
        status: 400,
      },
    );
  }

  const propietarioValido = PROPIETARIOS.find(
    (item) => item.nombre === propietario,
  );

  if (!propietarioValido) {
    return NextResponse.json(
      {
        error: "El propietario seleccionado no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const existente = await consultarUno<NumeroExistente>(
      `
          SELECT
            id::int
              AS id,

            activo::int
              AS activo

          FROM whatsapp_numeros

          WHERE
            numero = $1

          LIMIT 1
        `,
      [numero],
    );

    if (existente?.activo === 1) {
      return NextResponse.json(
        {
          error: "Ese número ya está registrado.",
        },
        {
          status: 409,
        },
      );
    }

    const fechaCreacion = new Date().toISOString();

    let fila: FilaNumeroWhatsapp | null = null;

    if (existente) {
      fila = await consultarUno<FilaNumeroWhatsapp>(
        `
            UPDATE whatsapp_numeros

            SET
              propietario = $1,
              propietario_tipo = $2,
              activo = 1,
              principal = $3,
              fecha_creacion = $4

            WHERE
              id = $5

            RETURNING
              id::int
                AS id,

              numero,
              propietario,
              propietario_tipo,

              activo::int
                AS activo,

              principal::int
                AS principal,

              fecha_creacion
          `,
        [
          propietario,
          propietarioValido.tipo,
          principal,
          fechaCreacion,
          existente.id,
        ],
      );
    } else {
      fila = await consultarUno<FilaNumeroWhatsapp>(
        `
            INSERT INTO whatsapp_numeros (
              numero,
              propietario,
              propietario_tipo,
              activo,
              principal,
              fecha_creacion
            )

            VALUES (
              $1,
              $2,
              $3,
              1,
              $4,
              $5
            )

            RETURNING
              id::int
                AS id,

              numero,
              propietario,
              propietario_tipo,

              activo::int
                AS activo,

              principal::int
                AS principal,

              fecha_creacion
          `,
        [numero, propietario, propietarioValido.tipo, principal, fechaCreacion],
      );
    }

    if (!fila) {
      throw new Error("No se pudo obtener el número registrado.");
    }

    return NextResponse.json(
      {
        ok: true,

        numero: serializarNumero(fila),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Error registrando número de WhatsApp:", error);

    return NextResponse.json(
      {
        error: "No se pudo registrar el número.",
      },
      {
        status: 500,
      },
    );
  }
}
