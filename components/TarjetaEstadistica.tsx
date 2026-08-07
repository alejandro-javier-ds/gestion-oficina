// components/TarjetaEstadistica.tsx

import type { LucideIcon } from "lucide-react";

type TarjetaEstadisticaProps = {
  etiqueta: string;
  valor: string | number;
  icono: LucideIcon;
  detalle?: string;
  acento?: "neutral" | "positivo" | "alerta";
};

const COLORES_ACENTO: Record<string, string> = {
  neutral: "var(--color-marca)",
  positivo: "#15803d",
  alerta: "#b45309",
};

export default function TarjetaEstadistica({
  etiqueta,
  valor,
  icono: Icono,
  detalle,
  acento = "neutral",
}: TarjetaEstadisticaProps) {
  const color = COLORES_ACENTO[acento];

  return (
    <div
      className="rounded border overflow-hidden flex shadow-sm"
      style={{
        borderColor: "var(--color-borde)",
        background: "var(--color-superficie)",
      }}
    >
      <div style={{ width: "4px", background: color }} />
      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-1">
          <p
            className="text-xs uppercase tracking-wide font-medium"
            style={{ color: "var(--color-texto-suave)" }}
          >
            {etiqueta}
          </p>
          <Icono size={16} style={{ color }} />
        </div>
        <p className="text-2xl font-bold dato-numerico" style={{ color }}>
          {valor}
        </p>
        {detalle && (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-texto-suave)" }}
          >
            {detalle}
          </p>
        )}
      </div>
    </div>
  );
}
