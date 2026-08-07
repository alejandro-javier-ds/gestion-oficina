// components/dashboard/GraficoTipoJuicio.tsx
// Distribución de gestiones por Tipo de Juicio,

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type FilaTipoJuicio = {
  tipoJuicio: string;
  cantidad: number;
};

const PALETA = [
  "var(--color-accion)",
  "var(--color-marca)",
  "#5eead4",
  "#a7f3d0",
  "#d4d4d8",
];

export default function GraficoTipoJuicio({
  datos,
}: {
  datos: FilaTipoJuicio[];
}) {
  const altura = Math.max(datos.length * 42, 160);

  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-4"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Gestiones por Tipo de Juicio
      </p>

      {datos.length === 0 ? (
        <p
          className="text-sm py-6 text-center"
          style={{ color: "var(--color-texto-tenue)" }}
        >
          Aún no hay gestiones registradas.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart data={datos} layout="vertical" margin={{ left: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--color-texto-suave)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="tipoJuicio"
              width={140}
              tick={{ fontSize: 11, fill: "var(--color-texto)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--color-borde)",
                boxShadow: "var(--sombra-md)",
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="cantidad"
              name="Gestiones"
              radius={[0, 4, 4, 0]}
              barSize={22}
            >
              {datos.map((_, i) => (
                <Cell key={i} fill={PALETA[i % PALETA.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
