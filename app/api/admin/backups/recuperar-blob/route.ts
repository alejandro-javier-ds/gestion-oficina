import { NextResponse } from "next/server";
import { isRestError } from "@azure/core-rest-pipeline";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { requerirAccesoApi } from "@/lib/api-acceso";
import { copiarRespaldoABlob } from "@/lib/backup-blob";

export const runtime = "nodejs";

const CARPETA_RESPALDOS = path.join(process.cwd(), "backups");

function resumirError(error: unknown) {
  const datos = error as { code?: unknown; statusCode?: unknown } | null;
  const codigoServicio = isRestError(error)
    ? error.response?.headers.get("x-ms-error-code")
    : undefined;
  const codigo =
    codigoServicio ?? datos?.code;
  const estado = datos?.statusCode;

  return {
    codigo:
      typeof codigo === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(codigo)
        ? codigo
        : "BlobUploadFailed",
    estadoHttp: typeof estado === "number" ? estado : undefined,
  };
}

export async function POST() {
  const acceso = await requerirAccesoApi(["administrador", "supervisor"]);
  if (!acceso.ok) return acceso.respuesta;

  let archivos: Dirent[];
  try {
    archivos = await fs.readdir(CARPETA_RESPALDOS, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({
        ok: true,
        revisados: 0,
        copiados: 0,
        existentes: 0,
        errores: [],
      }, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }

    const diagnostico = resumirError(error);
    console.error("[backup Blob] No se pudo revisar la carpeta de respaldos.", diagnostico);
    return NextResponse.json(
      { error: "No se pudo revisar la carpeta de respaldos." },
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const respaldos = archivos
    .filter(
      (archivo) =>
        archivo.isFile() &&
        archivo.name.startsWith("gestion-oficina_") &&
        archivo.name.endsWith(".dump"),
    )
    .map((archivo) => archivo.name)
    .sort();

  let copiados = 0;
  let existentes = 0;
  const errores: { nombre: string; codigo: string; estadoHttp?: number }[] = [];

  for (const nombre of respaldos) {
    try {
      const resultado = await copiarRespaldoABlob(
        path.join(CARPETA_RESPALDOS, nombre),
      );
      if (resultado === "copiado") copiados++;
      else existentes++;
    } catch (error) {
      const diagnostico = resumirError(error);
      errores.push({ nombre, ...diagnostico });
      console.error(
        `[backup Blob] No se pudo recuperar ${nombre}; el respaldo local se conserva.`,
        diagnostico,
      );
    }
  }

  return NextResponse.json({
    ok: errores.length === 0,
    revisados: respaldos.length,
    copiados,
    existentes,
    errores,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
