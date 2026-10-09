export const CODIGOS_DOLARES = ["USD", "DOLARES", "DÓLARES"];

export function normalizarMoneda(moneda?: string | null): "PEN" | "USD" {
  return CODIGOS_DOLARES.includes((moneda ?? "").trim().toUpperCase())
    ? "USD"
    : "PEN";
}

export function separarMontoPorMoneda(
  monto: number | null,
  moneda?: string | null,
): { soles: number; dolares: number } {
  return normalizarMoneda(moneda) === "USD"
    ? { soles: 0, dolares: monto ?? 0 }
    : { soles: monto ?? 0, dolares: 0 };
}
