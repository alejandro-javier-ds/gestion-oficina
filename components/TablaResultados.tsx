// components/TablaResultados.tsx
//
// Tabla de resultados.

"use client";

import { AnimatePresence, motion } from "framer-motion";

import { ChevronRight } from "lucide-react";

type ResultadoCliente = {
  idc: string;
  cliente: string;
  cantidadCuentas: number;
  montoDeudaTotal: number;
  primeraCuenta: string;
  segmentacion: string | null;
};

function formatearMoneda(valor: number): string {
  return `S/ ${valor.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function TablaResultados({
  cuentas,
  onAbrirCliente,
}: {
  cuentas: ResultadoCliente[];
  onAbrirCliente: (idc: string, nombre: string) => void;
}) {
  function abrirCliente(idc: string, nombre: string) {
    onAbrirCliente(idc, nombre);
  }

  return (
    <AnimatePresence mode="wait">
      {cuentas.length === 0 ? (
        <motion.p
          key="vacio"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.15,
          }}
          className="mt-2 text-sm"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          Sin resultados todavía.
        </motion.p>
      ) : (
        <motion.div
          key="lista"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.15,
          }}
          className="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-md"
          dir="ltr"
          style={{
            border: "1px solid var(--color-borde)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            className="text-sm border-collapse"
            style={{
              width: "100%",
              minWidth: "760px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--color-fondo-sutil)",
                }}
              >
                <th
                  className="text-center px-2 py-2.5 font-medium"
                  style={{
                    width: "42px",
                    minWidth: "42px",
                    color: "var(--color-texto-tenue)",
                    whiteSpace: "nowrap",
                  }}
                />

                <th
                  className="text-left px-4 py-2.5 font-medium"
                  style={{
                    width: "280px",
                    minWidth: "280px",
                    color: "var(--color-texto-suave)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Nombre de la cuenta / Razón social
                </th>

                <th
                  className="text-left px-4 py-2.5 font-medium"
                  style={{
                    width: "130px",
                    minWidth: "130px",
                    color: "var(--color-texto-suave)",
                    whiteSpace: "nowrap",
                  }}
                >
                  IDC
                </th>

                <th
                  className="text-left px-4 py-2.5 font-medium"
                  style={{
                    width: "100px",
                    minWidth: "100px",
                    color: "var(--color-texto-suave)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cuentas
                </th>

                <th
                  className="text-right px-4 py-2.5 font-medium"
                  style={{
                    width: "170px",
                    minWidth: "170px",
                    color: "var(--color-texto-suave)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Deuda Total
                </th>

                <th
                  className="text-left px-4 py-2.5 font-medium"
                  style={{
                    width: "150px",
                    minWidth: "150px",
                    color: "var(--color-texto-suave)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Segmentación
                </th>

                <th
                  className="text-center"
                  style={{
                    width: "42px",
                    minWidth: "42px",
                  }}
                />
              </tr>
            </thead>

            <tbody>
              {cuentas.map((c, i) => (
                <motion.tr
                  key={c.idc}
                  initial={{
                    opacity: 0,
                    y: 4,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.15,
                    delay: Math.min(i * 0.02, 0.2),
                  }}
                  whileTap={{
                    scale: 0.998,
                  }}
                  onClick={() => abrirCliente(c.idc, c.cliente)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();

                      abrirCliente(c.idc, c.cliente);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir cliente ${c.cliente}`}
                  className="cursor-pointer group transition-colors focus-visible:outline-none"
                  style={{
                    borderTop: "1px solid var(--color-borde)",
                    background: "var(--color-superficie)",
                  }}
                  whileHover={{
                    backgroundColor: "var(--color-superficie-hover)",
                  }}
                >
                  <td
                    className="text-center px-2 py-2 dato-numerico"
                    style={{
                      width: "42px",
                      minWidth: "42px",
                      color: "var(--color-texto-tenue)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {i + 1}
                  </td>

                  <td
                    className="px-4 py-2"
                    style={{
                      width: "280px",
                      minWidth: "280px",
                    }}
                  >
                    <span
                      className="block max-w-full font-medium uppercase truncate"
                      style={{
                        color: "var(--color-accion)",
                      }}
                      title={c.cliente}
                    >
                      {c.cliente}
                    </span>
                  </td>

                  <td
                    className="px-4 py-2 dato-numerico"
                    style={{
                      width: "130px",
                      minWidth: "130px",
                      color: "var(--color-texto-suave)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.idc}
                  </td>

                  <td
                    className="px-4 py-2 dato-numerico"
                    style={{
                      width: "100px",
                      minWidth: "100px",
                      color: "var(--color-texto-suave)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.cantidadCuentas}
                  </td>

                  <td
                    className="px-4 py-2 text-right dato-numerico"
                    style={{
                      width: "170px",
                      minWidth: "170px",
                      color: "var(--color-texto-suave)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatearMoneda(c.montoDeudaTotal)}
                  </td>

                  <td
                    className="px-4 py-2"
                    style={{
                      width: "150px",
                      minWidth: "150px",
                      color: "var(--color-texto-suave)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.segmentacion ?? "—"}
                  </td>

                  <td
                    className="px-2 py-2 text-center"
                    style={{
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    <ChevronRight
                      size={15}
                      className="opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        color: "var(--color-texto-tenue)",
                      }}
                    />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
