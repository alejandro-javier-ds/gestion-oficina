// components/dashboard/SelectorRangoFecha.tsx
// Selector de rango de fechas con atajos rápidos

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  Clock,
  History,
  TrendingUp,
  CalendarRange,
  CalendarDays,
  Check,
} from "lucide-react";

export type RangoFecha = { desde: string; hasta: string; etiqueta: string };

type Atajo = {
  etiqueta: string;
  icono: React.ReactNode;
  calcular: () => { desde: string; hasta: string };
};

function formatearISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function formatearCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function hoy(): Date {
  return new Date();
}

const ATAJOS: Atajo[] = [
  {
    etiqueta: "Hoy",
    icono: <Clock size={14} />,
    calcular: () => {
      const f = formatearISO(hoy());
      return { desde: f, hasta: f };
    },
  },
  {
    etiqueta: "Ayer",
    icono: <History size={14} />,
    calcular: () => {
      const d = hoy();
      d.setDate(d.getDate() - 1);
      const f = formatearISO(d);
      return { desde: f, hasta: f };
    },
  },
  {
    etiqueta: "Últimos 7 días",
    icono: <TrendingUp size={14} />,
    calcular: () => {
      const fin = hoy();
      const inicio = hoy();
      inicio.setDate(inicio.getDate() - 6);
      return { desde: formatearISO(inicio), hasta: formatearISO(fin) };
    },
  },
  {
    etiqueta: "Últimos 30 días",
    icono: <TrendingUp size={14} />,
    calcular: () => {
      const fin = hoy();
      const inicio = hoy();
      inicio.setDate(inicio.getDate() - 29);
      return { desde: formatearISO(inicio), hasta: formatearISO(fin) };
    },
  },
  {
    etiqueta: "Este mes",
    icono: <CalendarDays size={14} />,
    calcular: () => {
      const fin = hoy();
      const inicio = new Date(fin.getFullYear(), fin.getMonth(), 1);
      return { desde: formatearISO(inicio), hasta: formatearISO(fin) };
    },
  },
];

export function rangoInicial(): RangoFecha {
  const { desde, hasta } = ATAJOS[4].calcular();
  return { desde, hasta, etiqueta: "Este mes" };
}

export default function SelectorRangoFecha({
  valor,
  onCambiar,
}: {
  valor: RangoFecha;
  onCambiar: (rango: RangoFecha) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [personalizadoDesde, setPersonalizadoDesde] = useState(valor.desde);
  const [personalizadoHasta, setPersonalizadoHasta] = useState(valor.hasta);

  function elegirAtajo(atajo: Atajo) {
    const { desde, hasta } = atajo.calcular();
    onCambiar({ desde, hasta, etiqueta: atajo.etiqueta });
    setAbierto(false);
  }

  function aplicarPersonalizado() {
    if (!personalizadoDesde || !personalizadoHasta) return;
    onCambiar({
      desde: personalizadoDesde,
      hasta: personalizadoHasta,
      etiqueta: "Personalizado",
    });
    setAbierto(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-sm font-medium transition-all"
        style={{
          background: "var(--color-superficie)",
          color: "var(--color-texto)",
          boxShadow: abierto ? "var(--sombra-focus)" : "var(--sombra-sm)",
          border: `1px solid ${abierto ? "var(--color-accion)" : "var(--color-borde)"}`,
        }}
      >
        <span
          className="flex items-center justify-center rounded-md w-6 h-6 shrink-0"
          style={{
            background: "var(--color-accion-suave)",
            color: "var(--color-accion)",
          }}
        >
          <Calendar size={13} />
        </span>
        <span>{valor.etiqueta}</span>
        <span
          className="dato-numerico text-xs"
          style={{ color: "var(--color-texto-tenue)" }}
        >
          {formatearCorta(valor.desde)} → {formatearCorta(valor.hasta)}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--color-texto-tenue)",
            transition: "transform 150ms ease",
            transform: abierto ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      <AnimatePresence>
        {abierto && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setAbierto(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 rounded-xl z-40 w-72 overflow-hidden"
              style={{
                background: "var(--color-superficie)",
                border: "1px solid var(--color-borde)",
                boxShadow: "var(--sombra-lg)",
                transformOrigin: "top right",
              }}
            >
              <div className="p-1.5">
                {ATAJOS.map((atajo) => {
                  const activo = valor.etiqueta === atajo.etiqueta;
                  return (
                    <button
                      key={atajo.etiqueta}
                      onClick={() => elegirAtajo(atajo)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors"
                      style={{
                        background: activo
                          ? "var(--color-accion-suave)"
                          : "transparent",
                        color: activo
                          ? "var(--color-accion)"
                          : "var(--color-texto)",
                      }}
                      onMouseEnter={(e) => {
                        if (!activo)
                          e.currentTarget.style.background =
                            "var(--color-fondo-sutil)";
                      }}
                      onMouseLeave={(e) => {
                        if (!activo)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span
                        className="flex items-center justify-center rounded w-6 h-6 shrink-0"
                        style={{
                          background: activo
                            ? "var(--color-accion)"
                            : "var(--color-fondo-sutil)",
                          color: activo ? "white" : "var(--color-texto-suave)",
                        }}
                      >
                        {atajo.icono}
                      </span>
                      <span className="flex-1 text-left font-medium">
                        {atajo.etiqueta}
                      </span>
                      {activo && <Check size={14} />}
                    </button>
                  );
                })}
              </div>

              <div
                className="p-3"
                style={{
                  borderTop: "1px solid var(--color-borde)",
                  background: "var(--color-fondo-sutil)",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  <CalendarRange size={12} /> Rango personalizado
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label
                      className="text-xs block mb-1"
                      style={{ color: "var(--color-texto-tenue)" }}
                    >
                      Desde
                    </label>
                    <input
                      type="date"
                      value={personalizadoDesde}
                      onChange={(e) => setPersonalizadoDesde(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 rounded"
                      style={{
                        background: "var(--color-superficie)",
                        border: "1px solid var(--color-borde)",
                        colorScheme: "light",
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      className="text-xs block mb-1"
                      style={{ color: "var(--color-texto-tenue)" }}
                    >
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={personalizadoHasta}
                      onChange={(e) => setPersonalizadoHasta(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 rounded"
                      style={{
                        background: "var(--color-superficie)",
                        border: "1px solid var(--color-borde)",
                        colorScheme: "light",
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={aplicarPersonalizado}
                  className="boton-primario w-full text-sm py-2 mt-3"
                >
                  Aplicar rango
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
