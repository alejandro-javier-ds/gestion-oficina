// components/dashboard/GraficoGestionesPorCategoria.tsx

"use client";

import { motion } from "framer-motion";

type DatoCategoria = {
  categoria: string;
  cantidad: number;
};

const SEGMENTOS = ["#2874CF", "#4BCA81", "#F59E0B", "#8B5CF6", "#64748B"];

function abreviarCategoria(categoria: string): string {
  const valor = categoria.trim();

  if (!valor) {
    return "Otras";
  }

  return valor.length > 18 ? `${valor.slice(0, 18)}…` : valor;
}

export default function GraficoGestionesPorCategoria({
  datos,
}: {
  datos: DatoCategoria[];
}) {
  const datosLimpios = datos
    .filter((d) => Number(d.cantidad) > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  const total = datosLimpios.reduce((suma, d) => suma + d.cantidad, 0);

  if (!datosLimpios.length) {
    return (
      <div className="tarjeta p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-1">Gestiones por categoría</h3>

        <p
          className="text-sm"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          No hay datos para el rango seleccionado.
        </p>
      </div>
    );
  }

  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;

  let acumulado = 0;

  const segmentos = datosLimpios.map((dato, indice) => {
    const porcentaje = dato.cantidad / total;

    const dash = porcentaje * circunferencia;

    const offset = -acumulado * circunferencia;

    acumulado += porcentaje;

    return {
      ...dato,
      porcentaje,
      dash,
      offset,
      color: SEGMENTOS[indice % SEGMENTOS.length],
    };
  });

  return (
    <div className="tarjeta p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Gestiones por categoría</h3>

        <p
          className="text-xs mt-0.5"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          Distribución de la actividad registrada.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-4 items-center">
        <div className="flex justify-center">
          <div className="relative w-40 h-40 sm:w-44 sm:h-44">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={radio}
                fill="none"
                stroke="var(--color-borde)"
                strokeWidth="14"
              />

              {segmentos.map((segmento) => (
                <motion.circle
                  key={segmento.categoria}
                  cx="50"
                  cy="50"
                  r={radio}
                  fill="none"
                  stroke={segmento.color}
                  strokeWidth="14"
                  strokeLinecap="butt"
                  strokeDasharray={`0 ${circunferencia}`}
                  animate={{
                    strokeDasharray: `${segmento.dash} ${circunferencia}`,
                    strokeDashoffset: segmento.offset,
                  }}
                  transition={{
                    duration: 0.65,
                    ease: "easeOut",
                  }}
                />
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold dato-numerico">
                {total.toLocaleString("es-PE")}
              </span>

              <span
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                gestiones
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {segmentos.map((segmento) => (
            <div
              key={segmento.categoria}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: segmento.color,
                  }}
                />

                <span className="truncate">
                  {abreviarCategoria(segmento.categoria)}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold dato-numerico">
                  {segmento.cantidad.toLocaleString("es-PE")}
                </span>

                <span
                  className="text-xs"
                  style={{
                    color: "var(--color-texto-tenue)",
                  }}
                >
                  {(segmento.porcentaje * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
