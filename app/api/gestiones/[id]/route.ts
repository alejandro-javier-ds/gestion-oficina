// app/api/gestiones/[id]/route.ts
// Exclusivo Supervisor + Administrador.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";
import { SEGMENTACIONES } from "@/lib/catalogo-tipificacion";

const ROLES_QUE_PUEDEN_EDITAR = ["supervisor", "administrador"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para editar gestiones." },
      { status: 403 },
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

  const gestion = db.prepare("SELECT id FROM gestiones WHERE id = ?").get(id);

  if (!gestion) {
    return NextResponse.json(
      { error: "Gestión no encontrada" },
      { status: 404 },
    );
  }

  if (
    segmentacion != null &&
    segmentacion !== "" &&
    !SEGMENTACIONES.includes(segmentacion)
  ) {
    return NextResponse.json(
      { error: "La Segmentación debe ser una de las opciones válidas." },
      { status: 400 },
    );
  }

  if (
    monto_pagado != null &&
    (typeof monto_pagado !== "number" || monto_pagado < 0)
  ) {
    return NextResponse.json(
      { error: "El monto pagado debe ser un número positivo" },
      { status: 400 },
    );
  }

  if (
    monto_pagado != null &&
    moneda_monto_pagado != null &&
    !["Soles", "Dolares", "Dólares"].includes(moneda_monto_pagado)
  ) {
    return NextResponse.json(
      { error: "Moneda del monto pagado inválida" },
      { status: 400 },
    );
  }

  db.prepare(
    `
    UPDATE gestiones SET
      categoria = COALESCE(@categoria, categoria),
      codigo_razon = COALESCE(@codigo_razon, codigo_razon),
      segmentacion = COALESCE(@segmentacion, segmentacion),
      monto_pagado = @monto_pagado,
      moneda_monto_pagado = CASE
        WHEN @monto_pagado IS NULL THEN NULL
        ELSE COALESCE(@moneda_monto_pagado, moneda_monto_pagado, 'Soles')
      END,
      observacion = @observacion
    WHERE id = @id
  `,
  ).run({
    id,
    categoria: categoria ?? null,
    codigo_razon: codigo_razon ?? null,
    segmentacion: segmentacion || null,
    monto_pagado: monto_pagado ?? null,
    moneda_monto_pagado: moneda_monto_pagado ?? null,
    observacion: observacion ?? null,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_EDITAR.includes(sesion.rol)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para eliminar gestiones." },
      { status: 403 },
    );
  }

  const { id } = await params;

  const gestion = db.prepare("SELECT id FROM gestiones WHERE id = ?").get(id);

  if (!gestion) {
    return NextResponse.json(
      { error: "Gestión no encontrada" },
      { status: 404 },
    );
  }

  db.prepare("DELETE FROM gestiones WHERE id = ?").run(id);

  return NextResponse.json({ ok: true });
}
