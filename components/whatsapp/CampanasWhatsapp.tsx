// components/whatsapp/CampanasWhatsapp.tsx
// Selección de las seis campañas de la pestaña Gestiones.

"use client";

import {
  MessageCircleOff,
  Scale,
  UsersRound,
  AlertTriangle,
  Gavel,
  FileWarning,
  Check,
} from "lucide-react";

export type PropuestaId =
  | "sin_contacto"
  | "acuerdo_pago"
  | "contactados"
  | "renuente"
  | "remate_proceso"
  | "casos_especiales";

type Props = {
  valor: PropuestaId;
  onChange: (valor: PropuestaId) => void;
};

type Campana = {
  id: PropuestaId;
  nombre: string;
  descripcion: string;
  segmentaciones: string[];
  Icono: React.ElementType;
};

const CAMPANAS: Campana[] = [
  {
    id: "sin_contacto",
    nombre: "Sin contacto",
    descripcion: "Clientes sin contacto efectivo registrado.",
    segmentaciones: ["NO CONTACTO", "NO CONTACTO - NUEVO"],
    Icono: MessageCircleOff,
  },
  {
    id: "acuerdo_pago",
    nombre: "Acuerdo de pago",
    descripcion: "Clientes con acuerdo de pago registrado.",
    segmentaciones: ["ACUERDO DE PAGO"],
    Icono: Scale,
  },
  {
    id: "contactados",
    nombre: "Contactados",
    descripcion: "Clientes con contacto registrado.",
    segmentaciones: ["CONTACTO CON NEGOCIACION", "CONTACTO SIN NEGOCIACION"],
    Icono: UsersRound,
  },
  {
    id: "renuente",
    nombre: "Renuente",
    descripcion: "Clientes clasificados como renuentes.",
    segmentaciones: ["RENUENTE"],
    Icono: AlertTriangle,
  },
  {
    id: "remate_proceso",
    nombre: "Remate / Proceso judicial",
    descripcion: "Clientes en situaciones de remate o proceso judicial.",
    segmentaciones: [
      "REMATADO",
      "CONSIGNACION JUDICIAL",
      "SUSPENSION DE REMATE",
    ],
    Icono: Gavel,
  },
  {
    id: "casos_especiales",
    nombre: "Casos especiales",
    descripcion: "Situaciones especiales de cartera.",
    segmentaciones: ["CANCELADO", "FALLECIDO", "NO ASIGNADO"],
    Icono: FileWarning,
  },
];

export default function CampanasWhatsapp({ valor, onChange }: Props) {
  return (
    <section className="tarjeta p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Campaña</h2>

        <p
          className="mt-1 text-sm"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          Selecciona la campaña que quieres gestionar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CAMPANAS.map((campana) => {
          const activa = valor === campana.id;

          const Icono = campana.Icono;

          return (
            <button
              key={campana.id}
              type="button"
              onClick={() => onChange(campana.id)}
              className="relative rounded-lg border p-4 text-left transition-all duration-150"
              style={{
                borderColor: activa
                  ? "var(--color-accion)"
                  : "var(--color-borde)",
                background: activa
                  ? "var(--color-accion-suave)"
                  : "var(--color-superficie)",
                boxShadow: activa ? "0 0 0 1px var(--color-accion)" : "none",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: activa
                      ? "var(--color-superficie)"
                      : "var(--color-fondo-sutil)",
                    color: activa
                      ? "var(--color-accion)"
                      : "var(--color-texto-suave)",
                  }}
                >
                  <Icono size={17} />
                </div>

                <div className="min-w-0 flex-1 pr-5">
                  <h3 className="text-sm font-semibold sm:text-base">
                    {campana.nombre}
                  </h3>

                  <p
                    className="mt-1 text-xs sm:text-sm"
                    style={{
                      color: "var(--color-texto-suave)",
                    }}
                  >
                    {campana.descripcion}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {campana.segmentaciones.map((segmentacion) => (
                      <span
                        key={segmentacion}
                        className="chip chip-neutral text-[10px] sm:text-xs"
                      >
                        {segmentacion}
                      </span>
                    ))}
                  </div>
                </div>

                {activa && (
                  <div
                    className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      color: "var(--color-accion)",
                    }}
                  >
                    <Check size={17} strokeWidth={2.5} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
