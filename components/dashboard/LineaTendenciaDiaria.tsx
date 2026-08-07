// components/dashboard/LineaTendenciaDiaria.tsx
// Línea de gestiones por día.

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type FilaDia = {
  fecha: string;
  gestiones: number;
};

function formatearFechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export default function LineaTendenciaDiaria({ datos }: { datos: FilaDia[] }) {
  const hayDatos = datos.some((f) => f.gestiones > 0);

  return (
    <div className="tarjeta p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-4"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Gestiones por día — últimos 30 días
      </p>

      {!hayDatos ? (
        <p
          className="text-sm py-16 text-center"
          style={{ color: "var(--color-texto-tenue)" }}
        >
          Aún no hay gestiones registradas en este rango.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={datos} margin={{ left: -20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-borde)"
              vertical={false}
            />
            <XAxis
              dataKey="fecha"
              tickFormatter={(valor: string) => formatearFechaCorta(valor)}
              tick={{ fontSize: 11, fill: "var(--color-texto-suave)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-borde)" }}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-texto-suave)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(label) =>
                typeof label === "string" ? formatearFechaCorta(label) : label
              }
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--color-borde)",
                boxShadow: "var(--sombra-md)",
                fontSize: 13,
              }}
            />
            <Line
              type="monotone"
              dataKey="gestiones"
              stroke="var(--color-accion)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--color-accion)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
