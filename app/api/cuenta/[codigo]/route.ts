// app/api/cuenta/[codigo]/route.ts
// Trae una cuenta puntual, sus otras cuentas del mismo IDC, y sus
// teléfonos. Si el usuario es gestor, se bloquea el acceso a
// cuentas que no pertenezcan a su propia cartera.

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { codigo } = await params;

  const cuenta = db
    .prepare("SELECT * FROM cuentas WHERE codcuentacobranza = ?")
    .get(codigo) as { idc: string; gestor: string | null } | undefined;

  if (!cuenta) {
    return NextResponse.json(
      { error: "Cuenta no encontrada" },
      { status: 404 },
    );
  }

  if (sesion.rol === "gestor" && cuenta.gestor !== sesion.gestor) {
    return NextResponse.json(
      { error: "No tienes acceso a esta cuenta" },
      { status: 403 },
    );
  }

  const otrasCuentas = db
    .prepare(
      "SELECT * FROM cuentas WHERE idc = ? AND codcuentacobranza != ? AND activo = 1",
    )
    .all(cuenta.idc, codigo);

  const telefonos = db
    .prepare(
      `SELECT * FROM telefonos
       WHERE idc = ? AND activo = 1
       ORDER BY
         CASE tipo_telefono
           WHEN 'celular' THEN 0
           WHEN 'fijo' THEN 1
           ELSE 2
         END,
         qtty_phone_ranking DESC`,
    )
    .all(cuenta.idc) as { cic: string | null }[];

  const cic = telefonos.find((t) => t.cic)?.cic ?? null;

  return NextResponse.json({ cuenta, otrasCuentas, telefonos, cic });
}
