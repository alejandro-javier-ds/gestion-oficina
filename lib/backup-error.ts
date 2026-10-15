import { isRestError } from "@azure/core-rest-pipeline";

export type DiagnosticoRespaldo = {
  codigo: string;
  estadoHttp?: number;
};

export function diagnosticarErrorRespaldo(error: unknown): DiagnosticoRespaldo {
  const datos = error as { code?: unknown; statusCode?: unknown; name?: unknown } | null;
  const codigoServicio = isRestError(error)
    ? error.response?.headers.get("x-ms-error-code")
    : undefined;
  const codigoCrudo = codigoServicio ?? datos?.code ?? datos?.name;
  const estadoCrudo = isRestError(error) ? error.statusCode : datos?.statusCode;

  return {
    codigo:
      typeof codigoCrudo === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(codigoCrudo)
        ? codigoCrudo
        : "BackupFailed",
    estadoHttp: typeof estadoCrudo === "number" ? estadoCrudo : undefined,
  };
}
