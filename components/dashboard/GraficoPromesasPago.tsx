// components/dashboard/GraficoPromesasPago.tsx
// Comparativo de Promesas de Pago por estado Vigentes vs
// Cumplidas vs Rotas, para las promesas creadas dentro del rango de
// fechas elegido en el selector de la sección.

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

type DatosPromesas = {
  vigentes: number;
  cumplidas: number;
  rotas: number;
};

const COLOR_POR_ESTADO: Record<string, string> = {
  Vigentes: "var(--color-accion)",
  Cumplidas: "#15803d",
  Rotas: "#b91c1c",
};

export default function GraficoPromesasPago({
  datos,
}: {
  datos: DatosPromesas;
}) {
  const filas = [
    { estado: "Vigentes", cantidad: datos.vigentes },
    { estado: "Cumplidas", cantidad: datos.cumplidas },
    { estado: "Rotas", cantidad: datos.rotas },
  ];

  const total = datos.vigentes + datos.cumplidas + datos.rotas;

  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-4"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Promesas de Pago por Estado
      </p>

      {total === 0 ? (
        <p
          className="text-sm py-6 text-center"
          style={{ color: "var(--color-texto-tenue)" }}
        >
          Aún no hay promesas de pago registradas en este rango.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={filas} layout="vertical" margin={{ left: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--color-texto-suave)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="estado"
              width={80}
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
              name="Promesas"
              radius={[0, 4, 4, 0]}
              barSize={26}
            >
              {filas.map((f) => (
                <Cell key={f.estado} fill={COLOR_POR_ESTADO[f.estado]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
