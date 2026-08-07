// components/dashboard/GraficoPie.tsx
//
// Gráfico de dona.
// Se utiliza en PDPs y Gestiones.
//
// UX:
// - Responsive.
// - Framer Motion para entrada suave.
// - Recharts para el gráfico.
// - Leyenda reutilizable.
// - Compatible con colores personalizados.

"use client";

import { motion } from "framer-motion";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Rebanada = {
  nombre: string;
  cantidad: number;
};

const PALETA_DEFECTO = [
  "var(--color-accion)",
  "var(--color-marca)",
  "#5eead4",
  "#f97316",
  "#a78bfa",
  "#d4d4d8",
];

export default function GraficoPie({
  titulo,
  datos,
  colores,
  mensajeVacio = "No hay datos para el rango seleccionado.",
}: {
  titulo: string;
  datos: Rebanada[];
  colores?: Record<string, string>;
  mensajeVacio?: string;
}) {
  const datosValidos = datos.filter((d) => Number(d.cantidad) > 0);

  const total = datosValidos.reduce((suma, d) => suma + d.cantidad, 0);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 6,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.2,
      }}
      className="tarjeta p-4 sm:p-5 min-w-0"
    >
      <p
        className="text-xs uppercase tracking-wide font-medium mb-3"
        style={{
          color: "var(--color-texto-suave)",
        }}
      >
        {titulo}
      </p>

      {total === 0 ? (
        <p
          className="text-sm py-12 text-center"
          style={{
            color: "var(--color-texto-tenue)",
          }}
        >
          {mensajeVacio}
        </p>
      ) : (
        <div className="w-full min-w-0">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={datosValidos}
                dataKey="cantidad"
                nameKey="nombre"
                cx="50%"
                cy="44%"
                innerRadius={50}
                outerRadius={82}
                paddingAngle={2}
                isAnimationActive
                animationDuration={550}
                animationEasing="ease-out"
              >
                {datosValidos.map((d, i) => (
                  <Cell
                    key={d.nombre}
                    fill={
                      colores?.[d.nombre] ??
                      PALETA_DEFECTO[i % PALETA_DEFECTO.length]
                    }
                  />
                ))}
              </Pie>

              <Tooltip
                formatter={(valor, nombre) => [
                  Number(valor ?? 0).toLocaleString("es-PE"),
                  String(nombre ?? ""),
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-borde)",
                  boxShadow: "var(--sombra-md)",
                  fontSize: 13,
                }}
              />

              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  fontSize: 12,
                  paddingTop: 4,
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="text-center -mt-2">
            <span className="text-xl font-bold dato-numerico">
              {total.toLocaleString("es-PE")}
            </span>

            <span
              className="text-xs ml-1"
              style={{
                color: "var(--color-texto-tenue)",
              }}
            >
              total
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
