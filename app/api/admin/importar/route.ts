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
import { requerirAccesoApi } from "@/lib/api-acceso";

const ROLES_IMPORTACION = ["administrador", "supervisor"] as const;
const TAMANO_MAXIMO_ARCHIVO = 25 * 1024 * 1024;
const TAMANO_MAXIMO_SOLICITUD = TAMANO_MAXIMO_ARCHIVO + 1024 * 1024;

class ErrorSolicitudDemasiadoGrande extends Error {}

async function leerFormularioLimitado(request: NextRequest): Promise<FormData> {
  if (!request.body) throw new Error("El formulario está vacío.");
  const lector = request.body.getReader();
  const partes: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAMANO_MAXIMO_SOLICITUD) {
        await lector.cancel().catch(() => {});
        throw new ErrorSolicitudDemasiadoGrande();
      }
      partes.push(Buffer.from(value));
    }
  } finally {
    lector.releaseLock();
  }

  const formulario = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: Buffer.concat(partes),
  });
  return formulario.formData();
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const acceso = await requerirAccesoApi(ROLES_IMPORTACION);
  if (!acceso.ok) return acceso.respuesta;

  const longitud = Number(request.headers.get("content-length"));
  if (Number.isFinite(longitud) && longitud > TAMANO_MAXIMO_SOLICITUD) {
    return NextResponse.json({ error: "El archivo supera el límite de 25 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await leerFormularioLimitado(request);
  } catch (error) {
    if (error instanceof ErrorSolicitudDemasiadoGrande) {
      return NextResponse.json({ error: "El archivo supera el límite de 25 MB." }, { status: 413 });
    }
    return NextResponse.json({ error: "El formulario del archivo no es válido." }, { status: 400 });
  }

  const valorArchivo = formData.get("archivo");
  const archivo = typeof valorArchivo === "string" ? null : valorArchivo;

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

  if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    return NextResponse.json(
      { error: "El archivo debe tener contenido y no superar 25 MB." },
      { status: archivo.size > TAMANO_MAXIMO_ARCHIVO ? 413 : 400 },
    );
  }

  try {
    const arrayBuffer = await archivo.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return NextResponse.json({ error: "El contenido no corresponde a un archivo Excel XLSX válido." }, { status: 400 });
    }

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
