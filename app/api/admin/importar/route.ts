// app/api/admin/importar/route.ts
// Recibe un archivo Excel subido desde el Panel Admin y lo procesa
// con la misma lógica que usan los scripts de terminal. Protegido
// por el middleware (solo admins pueden llegar aquí).
// Ahora corre las 4 importaciones en una sola pasada

import { NextRequest, NextResponse } from "next/server";
import { importarPortafolioDesdeBuffer } from "@/lib/importar-cuentas";
import { importarTelefonosDesdeBuffer } from "@/lib/importar-telefonos";
import { importarGarantiasDesdeBuffer } from "@/lib/importar-garantias";
import { importarApersonamientoDesdeBuffer } from "@/lib/importar-apersonamiento";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const archivo = formData.get("archivo") as File | null;

  if (!archivo) {
    return NextResponse.json(
      { error: "No se recibió ningún archivo" },
      { status: 400 },
    );
  }

  const nombreValido = archivo.name.toLowerCase().endsWith(".xlsx");
  if (!nombreValido) {
    return NextResponse.json(
      { error: "El archivo debe ser un Excel (.xlsx)" },
      { status: 400 },
    );
  }

  try {
    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const resumen = importarPortafolioDesdeBuffer(buffer, archivo.name);
    const resumenTelefonos = importarTelefonosDesdeBuffer(buffer);
    const resumenGarantias = importarGarantiasDesdeBuffer(buffer);
    const resumenApersonamiento = importarApersonamientoDesdeBuffer(buffer);

    return NextResponse.json({
      ok: true,
      resumen,
      resumenTelefonos,
      resumenGarantias,
      resumenApersonamiento,
    });
  } catch (error) {
    const mensaje =
      error instanceof Error
        ? error.message
        : "Error desconocido al procesar el archivo";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
