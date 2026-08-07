// components/HistorialTabs.tsx

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import HistorialGestiones from "./HistorialGestiones";

type SubTab = "gestiones" | "negociaciones" | "asignaciones";

type HistorialRouter = {
  id: number;
  fecha_registro: string;
  seguimiento: string;
  router: string;
  descripcion: string | null;
};

function TabTexto({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 min-h-10 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
      style={{
        color: activo ? "var(--color-accion)" : "var(--color-texto-suave)",
        borderBottom: activo
          ? "2px solid var(--color-accion)"
          : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-");

  if (!anio || !mes || !dia) {
    return iso;
  }

  return `${dia} - ${mes} - ${anio}`;
}

export default function HistorialTabs({
  idc,
  refrescarSenal,
  historialRouter = [],
  rol,
}: {
  idc: string;
  refrescarSenal: number;
  historialRouter?: HistorialRouter[];
  rol?: string | null;
}) {
  const [subTab, setSubTab] = useState<SubTab>("gestiones");

  return (
    <div className="w-full min-w-0">
      <div
        className="flex overflow-x-auto overscroll-x-contain mb-4"
        style={{
          borderBottom: "1px solid var(--color-borde)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <TabTexto
          activo={subTab === "gestiones"}
          onClick={() => setSubTab("gestiones")}
        >
          Gestiones
        </TabTexto>

        <TabTexto
          activo={subTab === "negociaciones"}
          onClick={() => setSubTab("negociaciones")}
        >
          Negociaciones
        </TabTexto>

        <TabTexto
          activo={subTab === "asignaciones"}
          onClick={() => setSubTab("asignaciones")}
        >
          Asignaciones
          {historialRouter.length > 0 && ` (${historialRouter.length})`}
        </TabTexto>
      </div>

      <AnimatePresence mode="wait">
        {subTab === "gestiones" && (
          <motion.div
            key="gestiones"
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
          >
            <HistorialGestiones
              idc={idc}
              refrescarSenal={refrescarSenal}
              rol={rol}
            />
          </motion.div>
        )}

        {subTab === "negociaciones" && (
          <motion.div
            key="negociaciones"
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
            className="tarjeta p-6 sm:p-8 flex flex-col items-center text-center"
          >
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3"
              style={{
                background: "var(--color-fondo-sutil)",
                color: "var(--color-texto-tenue)",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 21a8 8 0 10-16 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                <circle
                  cx="12"
                  cy="8"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <p
              className="font-semibold text-sm mb-1"
              style={{
                color: "var(--color-texto)",
              }}
            >
              ¡Lo sentimos!
            </p>

            <p
              className="text-sm max-w-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Estamos trabajando para mejorar tu experiencia, por el momento no
              contamos con esta información. Pronto podrás ver el historial de
              tus negociaciones.
            </p>
          </motion.div>
        )}

        {subTab === "asignaciones" && (
          <motion.div
            key="asignaciones"
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
          >
            {historialRouter.length === 0 ? (
              <div className="tarjeta p-5 sm:p-6 text-center">
                <p
                  className="text-sm"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  Aún no hay historial de asignaciones registrado para este
                  cliente — se acumula automáticamente a partir de ahora, cada
                  vez que se importa un portafolio nuevo con cambios de Router.
                </p>
              </div>
            ) : (
              <div className="tabla-scroll rounded border border-[var(--color-borde)]">
                <table
                  className="w-full text-sm border-collapse"
                  style={{
                    minWidth: "650px",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "var(--color-fondo-sutil)",
                      }}
                    >
                      <th
                        className="text-left px-3 py-2 font-medium whitespace-nowrap"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        Fecha de Registro
                      </th>

                      <th
                        className="text-left px-3 py-2 font-medium whitespace-nowrap"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        Seguimiento
                      </th>

                      <th
                        className="text-left px-3 py-2 font-medium whitespace-nowrap"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        Router
                      </th>

                      <th
                        className="text-left px-3 py-2 font-medium whitespace-nowrap"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        Descripción
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {historialRouter.map((h) => (
                      <tr
                        key={h.id}
                        style={{
                          borderTop: "1px solid var(--color-borde)",
                        }}
                      >
                        <td className="px-3 py-2 dato-numerico whitespace-nowrap">
                          {formatearFecha(h.fecha_registro)}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap">
                          {h.seguimiento}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap">
                          {h.router}
                        </td>

                        <td className="px-3 py-2">
                          <span
                            className="block max-w-[360px] truncate"
                            title={h.descripcion ?? undefined}
                          >
                            {h.descripcion ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
