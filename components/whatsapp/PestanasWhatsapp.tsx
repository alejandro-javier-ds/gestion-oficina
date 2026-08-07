// components/whatsapp/PestanasWhatsapp.tsx
// Pestañas principales del módulo WhatsApp Masivo.
// "Exportar mensajes" exporta exclusivamente
// campañas/mensajes preparados de WhatsApp Masivo.

"use client";

import { MessageCircle, HandCoins, FileSpreadsheet } from "lucide-react";

export type ModuloWhatsapp = "gestiones" | "pdps" | "exportar_mensajes";

type Props = {
  valor: ModuloWhatsapp;

  onChange: (valor: ModuloWhatsapp) => void;
};

type Pestana = {
  id: ModuloWhatsapp;

  nombre: string;

  descripcion: string;

  Icono: typeof MessageCircle;
};

const PESTANAS: Pestana[] = [
  {
    id: "gestiones",

    nombre: "Gestiones",

    descripcion: "Campañas basadas en la última gestión realizada.",

    Icono: MessageCircle,
  },

  {
    id: "pdps",

    nombre: "PDPs",

    descripcion: "Campañas basadas en el estado de las promesas de pago.",

    Icono: HandCoins,
  },

  {
    id: "exportar_mensajes",

    nombre: "Exportar mensajes",

    descripcion:
      "Exporta las campañas y mensajes preparados de WhatsApp Masivo.",

    Icono: FileSpreadsheet,
  },
];

export default function PestanasWhatsapp({ valor, onChange }: Props) {
  return (
    <section className="tarjeta p-2 sm:p-3">
      <div className="grid gap-2 md:grid-cols-3">
        {PESTANAS.map(({ id, nombre, Icono }) => {
          const activa = valor === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="flex min-h-[64px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition"
              style={{
                background: activa ? "var(--color-superficie)" : "transparent",

                color: activa
                  ? "var(--color-accion)"
                  : "var(--color-texto-suave)",

                boxShadow: activa ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
              aria-selected={activa}
            >
              <Icono size={18} />

              <span>{nombre}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
