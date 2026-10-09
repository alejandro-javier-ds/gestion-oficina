export const MAX_LONGITUD_BUSQUEDA = 120;
export const MAX_PALABRAS_BUSQUEDA = 12;
export const MAX_CANDIDATOS_BUSQUEDA = 10_000;
export const MAX_LONGITUD_NOMBRE = 512;
export const MAX_OPERACIONES_BUSQUEDA = 5_000_000;

export class ErrorParametroBusqueda extends Error { }
export class ErrorLimiteBusqueda extends Error { }

export function validarTextoBusqueda(valor: string | null): string {
  if (valor == null) {
    throw new ErrorParametroBusqueda("Falta el parámetro q");
  }
  if (valor.length > MAX_LONGITUD_BUSQUEDA) {
    throw new ErrorParametroBusqueda(
      "La búsqueda admite hasta " + MAX_LONGITUD_BUSQUEDA + " caracteres.",
    );
  }
  const q = valor.trim();
  if (!q) throw new ErrorParametroBusqueda("Falta el parámetro q");
  if (q.split(/\s+/).length > MAX_PALABRAS_BUSQUEDA) {
    throw new ErrorParametroBusqueda(
      "La búsqueda admite hasta " + MAX_PALABRAS_BUSQUEDA + " palabras.",
    );
  }
  return q;
}

export type PresupuestoBusqueda = { restante: number };

export function crearPresupuestoBusqueda(): PresupuestoBusqueda {
  return { restante: MAX_OPERACIONES_BUSQUEDA };
}

export function distanciaLevenshteinAcotada(
  a: string,
  b: string,
  limite: number,
  presupuesto: PresupuestoBusqueda,
): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  if (b.length > a.length) [a, b] = [b, a];

  const fuera = limite + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) =>
    j <= limite ? j : fuera,
  );
  let actual = new Array<number>(b.length + 1).fill(fuera);

  for (let i = 1; i <= a.length; i++) {
    actual.fill(fuera);
    if (i <= limite) actual[0] = i;
    const inicio = Math.max(1, i - limite);
    const fin = Math.min(b.length, i + limite);
    let menor = actual[0];

    for (let j = inicio; j <= fin; j++) {
      if (presupuesto.restante <= 0) {
        throw new ErrorLimiteBusqueda(
          "La búsqueda es demasiado amplia. Usa un nombre más preciso o el IDC.",
        );
      }
      presupuesto.restante--;
      actual[j] = Math.min(
        anterior[j] + 1,
        actual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      menor = Math.min(menor, actual[j]);
    }
    if (menor > limite) return fuera;
    [anterior, actual] = [actual, anterior];
  }
  return anterior[b.length] <= limite ? anterior[b.length] : fuera;
}

export function similitudNombreAcotada(
  busqueda: string,
  nombreCompleto: string,
  presupuesto: PresupuestoBusqueda,
): number {
  if (nombreCompleto.length > MAX_LONGITUD_NOMBRE) {
    throw new ErrorLimiteBusqueda(
      "Un nombre supera el límite de esta búsqueda. Consulta al cliente por IDC.",
    );
  }
  const palabrasBusqueda = busqueda.toLowerCase().trim().split(/\s+/);
  const palabrasNombre = nombreCompleto.toLowerCase().trim().split(/\s+/);
  const limiteTotal = 3 * palabrasBusqueda.length;
  let distanciaTotal = 0;

  for (const palabraBusqueda of palabrasBusqueda) {
    const restante = limiteTotal - distanciaTotal;
    let mejor = restante + 1;
    for (const palabraNombre of palabrasNombre) {
      mejor = Math.min(
        mejor,
        distanciaLevenshteinAcotada(
          palabraBusqueda,
          palabraNombre,
          restante,
          presupuesto,
        ),
      );
      if (mejor === 0) break;
    }
    if (mejor > restante) return limiteTotal + 1;
    distanciaTotal += mejor;
  }
  return distanciaTotal;
}
