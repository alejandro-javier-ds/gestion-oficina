// components/HeaderCliente.tsx
// Header de la ficha de cliente.

"use client";

import { motion } from "framer-motion";

const AZUL_HEADER = "#004E8A";
const GRIS_FRANJA = "#F3F3F3";

export default function HeaderCliente({
  idc,
  cliente,
  cic,
  segmentacion,
  prioridad,
  router,
  nivelRiesgo,
  onCrearGestion,
}: {
  idc: string;
  cliente: string;
  cic: string | null;
  segmentacion: string | null;
  prioridad: string | null;
  router: string | null;
  nivelRiesgo: string | null;
  estrategiaCliente?: string | null;
  rol?: string | null;
  onCrearGestion?: () => void;
}) {
  return (
    <motion.div
      className="tema-gestor"
      initial={{
        opacity: 0,
        y: 6,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.18,
        ease: "easeOut",
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div
            className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-start"
            style={{
              background: AZUL_HEADER,
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide opacity-90 text-white">
                Cuenta Personal
              </div>

              <h1
                className="text-[18px] sm:text-[20px] font-bold leading-tight text-white break-words sm:truncate"
                title={cliente}
              >
                {cliente}
              </h1>
            </div>

            {onCrearGestion && (
              <button
                type="button"
                onClick={onCrearGestion}
                className="w-full sm:w-auto min-h-10 text-sm font-medium px-4 py-2 rounded transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 shrink-0"
                style={{
                  background: "var(--color-accion)",
                  color: "white",
                }}
              >
                + Crear Gestión
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-3 bg-white">
            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 mb-0.5">IDC</div>

              <div className="text-[13px] text-gray-900 dato-numerico break-words">
                {idc}
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 mb-0.5">CIC</div>

              <div className="text-[13px] text-gray-900 dato-numerico break-words">
                {cic ?? "—"}
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 mb-0.5">
                Segmentación
              </div>

              <div
                className="text-[13px] text-gray-900 break-words"
                title={segmentacion ?? undefined}
              >
                {segmentacion ?? "—"}
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 py-3 relative items-center"
            style={{
              background: GRIS_FRANJA,
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 mb-0.5">Prioridad</div>

              <div className="text-[13px] text-gray-900 break-words">
                {prioridad ?? "—"}
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 mb-0.5">Router</div>

              <div className="text-[13px] text-gray-900 break-words">
                {router ?? "—"}
              </div>
            </div>

            <div className="min-w-0 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-gray-500 mb-0.5">
                Nivel de Riesgo
              </div>

              <div className="text-[13px] text-gray-900 break-words">
                {nivelRiesgo ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
