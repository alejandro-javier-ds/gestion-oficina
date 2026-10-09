// app/admin/page.tsx
//
// Dashboard del Panel Admin.

"use client";

import { useRef, useState } from "react";
import { Gauge, ListTree, HandCoins } from "lucide-react";

import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";
import SeccionIndicadores from "@/components/dashboard/SeccionIndicadores";
import SeccionGestiones from "@/components/dashboard/SeccionGestiones";
import SeccionPDPs from "@/components/dashboard/SeccionPDPs";

type Seccion = "indicadores" | "gestiones" | "pdps";

const SECCIONES: {
  id: Seccion;
  etiqueta: string;
  icono: React.ReactNode;
  descripcion: string;
}[] = [
  {
    id: "indicadores",
    etiqueta: "Indicadores",
    icono: <Gauge size={16} />,
    descripcion:
      "KPIs diarios por gestor — intensidad, contactabilidad, tendencia",
  },
  {
    id: "gestiones",
    etiqueta: "Gestiones",
    icono: <ListTree size={16} />,
    descripcion:
      "Detalle de cada gestión registrada — actividad, categorías, tabla dinámica",
  },
  {
    id: "pdps",
    etiqueta: "PDPs",
    icono: <HandCoins size={16} />,
    descripcion: "Promesas de Pago — estado, tipo, y tabla dinámica",
  },
];

export default function DashboardAdminPage() {
  const [seccionActiva, setSeccionActiva] = useState<Seccion>("indicadores");

  const referenciasTab = useRef<Record<Seccion, HTMLButtonElement | null>>({
    indicadores: null,
    gestiones: null,
    pdps: null,
  });

  function manejarTeclado(e: React.KeyboardEvent, indiceActual: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") {
      return;
    }

    e.preventDefault();

    const direccion = e.key === "ArrowRight" ? 1 : -1;

    const siguienteIndice =
      (indiceActual + direccion + SECCIONES.length) % SECCIONES.length;

    const siguiente = SECCIONES[siguienteIndice];

    setSeccionActiva(siguiente.id);

    referenciasTab.current[siguiente.id]?.focus();
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 min-w-0">
      <HeaderPanelAdmin
        titulo="Dashboard"
        descripcion="Resumen de indicadores — Estudio Caillaux"
      />

      <div className="overflow-x-auto overscroll-x-contain mb-5 sm:mb-6">
        <div
          role="tablist"
          aria-label="Secciones del Dashboard"
          className="flex gap-1 p-1 rounded-lg w-max min-w-full sm:min-w-0"
          style={{
            background: "var(--color-fondo-sutil)",
          }}
        >
          {SECCIONES.map((s, i) => {
            const activa = seccionActiva === s.id;

            return (
              <button
                key={s.id}
                ref={(el) => {
                  referenciasTab.current[s.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={activa}
                aria-controls={`panel-${s.id}`}
                tabIndex={activa ? 0 : -1}
                onClick={() => setSeccionActiva(s.id)}
                onKeyDown={(e) => manejarTeclado(e, i)}
                className="flex items-center justify-center gap-2 shrink-0 min-h-10 px-3 sm:px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: activa
                    ? "var(--color-superficie)"
                    : "transparent",
                  color: activa
                    ? "var(--color-accion)"
                    : "var(--color-texto-suave)",
                  boxShadow: activa ? "var(--sombra-sm)" : "none",
                  outlineColor: "var(--color-accion)",
                }}
              >
                {s.icono}
                {s.etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      <p
        className="text-sm mb-4 leading-relaxed"
        style={{
          color: "var(--color-texto-suave)",
        }}
      >
        {SECCIONES.find((s) => s.id === seccionActiva)?.descripcion}
      </p>

      <div
        role="tabpanel"
        id="panel-indicadores"
        aria-labelledby="tab-indicadores"
        className={seccionActiva === "indicadores" ? "block" : "hidden"}
      >
        <SeccionIndicadores />
      </div>

      <div
        role="tabpanel"
        id="panel-gestiones"
        aria-labelledby="tab-gestiones"
        className={seccionActiva === "gestiones" ? "block" : "hidden"}
      >
        <SeccionGestiones />
      </div>

      <div
        role="tabpanel"
        id="panel-pdps"
        aria-labelledby="tab-pdps"
        className={seccionActiva === "pdps" ? "block" : "hidden"}
      >
        <SeccionPDPs />
      </div>
    </div>
  );
}
