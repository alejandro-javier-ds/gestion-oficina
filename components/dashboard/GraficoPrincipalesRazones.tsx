// components/dashboard/GraficoPrincipalesRazones.tsx
//
// Ranking de las principales razones de gestión.
// No utiliza barras para evitar sobrecargar visualmente

"use client";

import { motion } from "framer-motion";

type DatoRazon = {
  razon: string;
  cantidad: number;
};

function separarRazon(valor: string) {
  const partes = valor.split(" - ");

  if (partes.length <= 1) {
    return {
      codigo: "—",
      descripcion: valor,
    };
  }

  return {
    codigo: partes[0].trim(),
    descripcion: partes.slice(1).join(" - ").trim(),
  };
}

export default function GraficoPrincipalesRazones({
  datos,
}: {
  datos: DatoRazon[];
}) {
  const datosLimpios = datos
    .filter((d) => Number(d.cantidad) > 0)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  if (!datosLimpios.length) {
    return (
      <div className="tarjeta p-4 sm:p-5">
        <h3 className="text-sm font-semibold">
          Principales razones de gestión
        </h3>

        <p
          className="text-sm py-12 text-center"
          style={{
            color: "var(--color-texto-tenue)",
          }}
        >
          No hay razones registradas para el rango seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="tarjeta p-4 sm:p-5 min-w-0">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">
          Principales razones de gestión
        </h3>

        <p
          className="text-xs mt-0.5"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          Top 10 razones más frecuentes del rango seleccionado.
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {datosLimpios.map((dato, indice) => {
          const razon = separarRazon(dato.razon);

          return (
            <motion.div
              key={dato.razon}
              initial={{
                opacity: 0,
                y: 4,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.18,
                delay: indice * 0.025,
              }}
              className="flex items-center gap-2.5 py-2.5"
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                style={{
                  background:
                    indice === 0
                      ? "var(--color-accion)"
                      : "var(--color-fondo-sutil)",
                  color: indice === 0 ? "white" : "var(--color-texto-suave)",
                }}
              >
                {String(indice + 1).padStart(2, "0")}
              </span>

              <span
                className="min-w-[34px] text-xs font-bold dato-numerico"
                style={{
                  color: "var(--color-accion)",
                }}
              >
                {razon.codigo}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate" title={razon.descripcion}>
                  {razon.descripcion}
                </p>
              </div>

              <span className="text-sm font-bold dato-numerico shrink-0">
                {dato.cantidad.toLocaleString("es-PE")}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
