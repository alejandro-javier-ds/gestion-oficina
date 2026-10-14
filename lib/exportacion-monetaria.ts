export function valorMonetarioExcel(valor: string | null): string | number | null {
  if (valor === null) return null;
  const normalizado = valor.trim();
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(normalizado)) return valor;
  const digitosSignificativos = normalizado
    .replace(/^-/, "")
    .replace(".", "")
    .replace(/^0+/, "")
    .replace(/0+$/, "");
  const numero = Number(normalizado);
  const unidadesDePrecision = Math.round(numero * 10_000);
  if (
    !Number.isFinite(numero) ||
    digitosSignificativos.length > 15 ||
    !Number.isSafeInteger(unidadesDePrecision)
  ) {
    return normalizado;
  }
  return numero;
}
