// app/api/admin/importar/route.ts
// Importa el portafolio completo.
//
// Toda la operación se ejecuta como una sola transacción:
//
// Cuentas -> Telefonos -> Garantias -> Apersonamiento

import { NextRequest, NextResponse } from "next/server";

import { conTransaccion } from "@/lib/postgres";

import { importarPortafolioDesdeBuffer } from "@/lib/importar-cuentas";

import { importarTelefonosDesdeBuffer } from "@/lib/importar-telefonos";

import { importarGarantiasDesdeBuffer } from "@/lib/importar-garantias";

import { importarApersonamientoDesdeBuffer } from "@/lib/importar-apersonamiento";

import { ErrorFormatoPortafolio } from "@/lib/portafolio-excel";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const archivo = formData.get("archivo") as File | null;

  if (!archivo) {
    return NextResponse.json(
      {
        error: "No se recibió ningún archivo",
      },
      {
        status: 400,
      },
    );
  }

  if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      {
        error: "El archivo debe ser un Excel (.xlsx)",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const arrayBuffer = await archivo.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const resultado = await conTransaccion(async (cliente) => {
      await cliente.query(
        `
              SET LOCAL
                idle_in_transaction_session_timeout = '5min'
            `,
      );

      const resumen = await importarPortafolioDesdeBuffer(buffer, archivo.name);

      const resumenTelefonos = await importarTelefonosDesdeBuffer(buffer);

      const resumenGarantias = await importarGarantiasDesdeBuffer(buffer);

      const resumenApersonamiento =
        await importarApersonamientoDesdeBuffer(buffer);

      return {
        resumen,
        resumenTelefonos,
        resumenGarantias,
        resumenApersonamiento,
      };
    });

    return NextResponse.json({
      ok: true,
      ...resultado,
    });
  } catch (error) {
    console.error("[Importación portafolio]", error);

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error desconocido al procesar el archivo";

    return NextResponse.json(
      {
        error: mensaje,
      },
      {
        status: error instanceof ErrorFormatoPortafolio ? 400 : 500,
      },
    );
  }
}
