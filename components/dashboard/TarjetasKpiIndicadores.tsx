// components/dashboard/TarjetasKpiIndicadores.tsx
// Tarjetas KPI de la sección Indicadores: gestiones y clientes
// distintos gestionados EN EL RANGO ELEGIDO

type Props = {
  totalGestiones: number;
  clientesDistintos: number;
  etiquetaRango: string;
};

export default function TarjetasKpiIndicadores({
  totalGestiones,
  clientesDistintos,
  etiquetaRango,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="tarjeta p-4 sm:p-5">
        <p
          className="text-xs uppercase tracking-wide font-medium"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Gestiones — {etiquetaRango}
        </p>
        <p
          className="mt-1 font-bold dato-numerico"
          style={{
            fontSize: "clamp(1.75rem, 5vw, var(--texto-3xl))",
            color: "var(--color-texto)",
          }}
        >
          {totalGestiones.toLocaleString("es-PE")}
        </p>
      </div>

      <div className="tarjeta p-4 sm:p-5">
        <p
          className="text-xs uppercase tracking-wide font-medium"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Clientes distintos gestionados — {etiquetaRango}
        </p>
        <p
          className="mt-1 font-bold dato-numerico"
          style={{
            fontSize: "clamp(1.75rem, 5vw, var(--texto-3xl))",
            color: "var(--color-texto)",
          }}
        >
          {clientesDistintos.toLocaleString("es-PE")}
        </p>
      </div>
    </div>
  );
}
