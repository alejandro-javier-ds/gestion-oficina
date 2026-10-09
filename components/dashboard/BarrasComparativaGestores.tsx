// components/dashboard/BarrasComparativaGestores.tsx
// Barras agrupadas comparando a los gestores: intensidad y
// contactabilidad lado a lado.

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type FilaGestor = {
  gestor: string;
  intensidad: number;
  contactabilidad: number;
};

export default function BarrasComparativaGestores({
  datos,
}: {
  datos: FilaGestor[];
}) {
  const hayDatos = datos.some((f) => f.intensidad > 0 || f.contactabilidad > 0);

  return (
    <div className="tarjeta p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-4"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Comparativa por gestor
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
          <BarChart data={datos} margin={{ left: -20 }}>
            <XAxis
              dataKey="gestor"
              tick={{ fontSize: 12, fill: "var(--color-texto-suave)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-borde)" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-texto-suave)" }}
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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="intensidad"
              name="Intensidad"
              fill="var(--color-accion)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="contactabilidad"
              name="Contactabilidad %"
              fill="var(--color-marca)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
