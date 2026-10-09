// components/whatsapp/CampanasPdpWhatsapp.tsx
// Selector de las 3 campañas PDP.
//
// Cada campaña corresponde directamente a:
// - Posible Pago
// - 100% Confiable
// - Fin de Acuerdo

"use client";

import { HandCoins, CircleDollarSign, BadgeCheck } from "lucide-react";

import type { CampanaPdpWhatsapp } from "@/lib/whatsapp/plantillas-pdp";

type Props = {
  valor: CampanaPdpWhatsapp;
  onChange: (valor: CampanaPdpWhatsapp) => void;
};

const CAMPANAS: Array<{
  id: CampanaPdpWhatsapp;
  nombre: string;
  descripcion: string;
  Icono: typeof HandCoins | typeof CircleDollarSign | typeof BadgeCheck;
}> = [
  {
    id: "posible_pago",
    nombre: "Posible Pago",
    descripcion: "Monto en evaluación y negociación pendiente.",
    Icono: HandCoins,
  },
  {
    id: "cien_confiable",
    nombre: "100% Confiable",
    descripcion: "Monto y fecha de pago definidos.",
    Icono: BadgeCheck,
  },
  {
    id: "fin_acuerdo",
    nombre: "Fin de Acuerdo",
    descripcion: "Acuerdo de pago culminado.",
    Icono: CircleDollarSign,
  },
];

export default function CampanasPdpWhatsapp({ valor, onChange }: Props) {
  return (
    <section className="tarjeta p-2 sm:p-3">
      <div className="grid gap-2 md:grid-cols-3">
        {CAMPANAS.map(({ id, nombre, descripcion, Icono }) => {
          const activo = valor === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="rounded-xl border p-4 text-left transition"
              style={{
                borderColor: activo
                  ? "var(--color-accion)"
                  : "var(--color-borde)",

                background: activo
                  ? "var(--color-accion-suave)"
                  : "var(--color-fondo-sutil)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: activo
                      ? "var(--color-superficie)"
                      : "var(--color-fondo-sutil)",

                    color: activo
                      ? "var(--color-accion)"
                      : "var(--color-texto-suave)",
                  }}
                >
                  <Icono size={17} />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold">{nombre}</p>

                  <p
                    className="mt-1 text-xs"
                    style={{
                      color: "var(--color-texto-suave)",
                    }}
                  >
                    {descripcion}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
