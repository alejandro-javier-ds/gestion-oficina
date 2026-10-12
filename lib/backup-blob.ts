import { ManagedIdentityCredential } from "@azure/identity";
import { createDefaultHttpClient } from "@azure/core-rest-pipeline";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";

type ResultadoCopia = "copiado" | "existente";

const URL_STORAGE = "https://stgestionescaillaux.blob.core.windows.net";
const CONTENEDOR = "backups-postgresql";
const cargasEnCurso = new Map<string, Promise<ResultadoCopia>>();
let contenedor: ContainerClient | undefined;
const clienteHttpIdentidad = createDefaultHttpClient();

function obtenerContenedor() {
  if (!process.env.IDENTITY_ENDPOINT || !process.env.IDENTITY_HEADER) {
    throw Object.assign(new Error("Identidad administrada no disponible."), {
      code: "ManagedIdentityUnavailable",
    });
  }

  contenedor ??= new BlobServiceClient(
    URL_STORAGE,
    new ManagedIdentityCredential({
      clientId: process.env.AZURE_CLIENT_ID,
      retryOptions: { maxRetries: 2 },
      httpClient: {
        sendRequest(request) {
          request.timeout = 10_000;
          return clienteHttpIdentidad.sendRequest(request);
        },
      },
    }),
    {
      retryOptions: {
        maxTries: 3,
        tryTimeoutInMs: 30_000,
        retryDelayInMs: 1_000,
        maxRetryDelayInMs: 5_000,
      },
    },
  ).getContainerClient(CONTENEDOR);

  return contenedor;
}

function tieneCodigo(error: unknown, estado: number, ...codigos: string[]) {
  if (typeof error !== "object" || error === null) return false;
  const datos = error as { statusCode?: number; code?: string };
  return datos.statusCode === estado && codigos.includes(datos.code ?? "");
}

async function cargarRespaldo(ruta: string): Promise<ResultadoCopia> {
  const cliente = obtenerContenedor().getBlockBlobClient(path.basename(ruta));
  const stats = await fs.stat(ruta);
  if (!stats.isFile() || stats.size === 0) {
    throw Object.assign(new Error("El respaldo no es un archivo válido."), {
      code: "InvalidBackupFile",
    });
  }

  const abortSignal = AbortSignal.timeout(120_000);
  const hash = createHash("sha256");
  for await (const bloque of createReadStream(ruta, { signal: abortSignal })) {
    hash.update(bloque);
  }
  const sha256 = hash.digest("hex");

  async function yaExiste() {
    try {
      const propiedades = await cliente.getProperties({ abortSignal });
      if (
        propiedades.contentLength !== stats.size ||
        propiedades.metadata?.sha256 !== sha256
      ) {
        throw Object.assign(new Error("Existe otro respaldo con ese nombre."), {
          code: "BackupBlobNameConflict",
        });
      }
      return true;
    } catch (error) {
      if (tieneCodigo(error, 404, "BlobNotFound")) return false;
      throw error;
    }
  }

  if (await yaExiste()) return "existente";

  try {
    await cliente.uploadFile(ruta, {
      abortSignal,
      conditions: { ifNoneMatch: "*" },
      metadata: { sha256 },
      blobHTTPHeaders: { blobContentType: "application/octet-stream" },
      blockSize: 4 * 1024 * 1024,
      maxSingleShotSize: 8 * 1024 * 1024,
      concurrency: 2,
    });
    return "copiado";
  } catch (error) {
    if (
      (tieneCodigo(error, 409, "BlobAlreadyExists") ||
        tieneCodigo(error, 412, "ConditionNotMet")) &&
      (await yaExiste())
    ) {
      return "existente";
    }
    throw error;
  }
}

export function copiarRespaldoABlob(ruta: string): Promise<ResultadoCopia> {
  const rutaAbsoluta = path.resolve(ruta);
  const enCurso = cargasEnCurso.get(rutaAbsoluta);
  if (enCurso) return enCurso;

  const carga = cargarRespaldo(rutaAbsoluta).finally(() => {
    cargasEnCurso.delete(rutaAbsoluta);
  });
  cargasEnCurso.set(rutaAbsoluta, carga);
  return carga;
}
