import {
  FUNCIONARIOS_EXCLUIDOS,
  FUNCIONARIOS_PERMITIDOS,
} from "./mapeo-columnas";
import { FilaPortafolio, normalizarTextoPortafolio } from "./portafolio-excel";

export type CuentaReferenciaCartera = {
  codcuentacobranza: string;
  idc: string;
  funcionario: string | null;
  activo: number;
};

export function seleccionarFilasCartera(
  filas: FilaPortafolio[],
  cuentas: CuentaReferenciaCartera[],
): { filas: FilaPortafolio[]; funcionariosReconocidos: string[] } {
  const excluidos = new Set(
    FUNCIONARIOS_EXCLUIDOS.map(normalizarTextoPortafolio),
  );
  const permitidos = new Set(
    FUNCIONARIOS_PERMITIDOS.map(normalizarTextoPortafolio),
  );
  const actuales = new Map(
    cuentas
      .filter((cuenta) => cuenta.activo === 1)
      .map((cuenta) => [cuenta.codcuentacobranza, cuenta]),
  );
  for (const cuenta of actuales.values()) {
    const funcionario = normalizarTextoPortafolio(cuenta.funcionario);
    if (funcionario && !excluidos.has(funcionario)) permitidos.add(funcionario);
  }

  const reconocidos = new Map<string, string>();
  for (const fila of filas) {
    const funcionario = normalizarTextoPortafolio(fila.FUNCIONARIO);
    if (
      !funcionario ||
      excluidos.has(funcionario) ||
      permitidos.has(funcionario)
    )
      continue;
    const cuenta = actuales.get(String(fila.CODCUENTACOBRANZA ?? "").trim());
    if (
      cuenta &&
      normalizarTextoPortafolio(cuenta.idc) ===
      normalizarTextoPortafolio(fila.IDC)
    ) {
      permitidos.add(funcionario);
      reconocidos.set(funcionario, String(fila.FUNCIONARIO).trim());
    }
  }

  return {
    filas: filas.filter((fila) => {
      const funcionario = normalizarTextoPortafolio(fila.FUNCIONARIO);
      return !excluidos.has(funcionario) && permitidos.has(funcionario);
    }),
    funcionariosReconocidos: [...reconocidos.values()].sort(),
  };
}
