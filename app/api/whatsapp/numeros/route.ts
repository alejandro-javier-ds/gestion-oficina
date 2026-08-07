// app/api/whatsapp/numeros/route.ts
// Gestiona los números desde los cuales se pueden preparar
// campañas de WhatsApp.
//
// GET  -> números registrados y activos.
// POST -> registrar un número.

import { NextRequest, NextResponse } from "next/server";

import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

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

function serializarNumero(fila: {
  id: number;
  numero: string;
  propietario: string;
  propietario_tipo: string;
  activo: number;
  principal: number;
  fecha_creacion: string;
}): NumeroWhatsapp {
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

  const filas = db
    .prepare(
      `
      SELECT
        id,
        numero,
        propietario,
        propietario_tipo,
        activo,
        principal,
        fecha_creacion
      FROM whatsapp_numeros
      WHERE activo = 1
      ORDER BY
        principal DESC,
        propietario COLLATE NOCASE,
        id ASC
    `,
    )
    .all() as Array<{
      id: number;
      numero: string;
      propietario: string;
      propietario_tipo: string;
      activo: number;
      principal: number;
      fecha_creacion: string;
    }>;

  return NextResponse.json({
    numeros: filas.map(serializarNumero),
  });
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

  const existente = db
    .prepare(
      `
      SELECT
        id,
        activo
      FROM whatsapp_numeros
      WHERE numero = ?
      LIMIT 1
    `,
    )
    .get(numero) as
    | {
      id: number;
      activo: number;
    }
    | undefined;

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

  try {
    const resultado = db
      .prepare(
        `
        INSERT INTO whatsapp_numeros (
          numero,
          propietario,
          propietario_tipo,
          activo,
          principal,
          fecha_creacion
        )
        VALUES (?, ?, ?, 1, ?, ?)
      `,
      )
      .run(
        numero,
        propietario,
        propietarioValido.tipo,
        principal,
        fechaCreacion,
      );

    const fila = db
      .prepare(
        `
        SELECT
          id,
          numero,
          propietario,
          propietario_tipo,
          activo,
          principal,
          fecha_creacion
        FROM whatsapp_numeros
        WHERE id = ?
      `,
      )
      .get(resultado.lastInsertRowid) as {
        id: number;
        numero: string;
        propietario: string;
        propietario_tipo: string;
        activo: number;
        principal: number;
        fecha_creacion: string;
      };

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
