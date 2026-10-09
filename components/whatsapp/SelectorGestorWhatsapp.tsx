// components/whatsapp/SelectorGestorWhatsapp.tsx
// Selector de cartera para WhatsApp Masivo.
// "Todos los gestores" incluye todas las carteras disponibles.
// Miguel Rodriguez aparece como supervisor, pero no implica
// que tenga cartera propia.

"use client";

import { UserRound } from "lucide-react";

type Props = {
  valor: string;
  onChange: (valor: string) => void;
};

type Gestor = {
  id: string;
  nombre: string;
  tipo: "gestor" | "supervisor";
};

const GESTORES: Gestor[] = [
  {
    id: "Geraldine Salazar",
    nombre: "Geraldine Salazar",
    tipo: "gestor",
  },
  {
    id: "Glycel Lozada",
    nombre: "Glycel Lozada",
    tipo: "gestor",
  },
  {
    id: "Gonzalo Barrientos",
    nombre: "Gonzalo Barrientos",
    tipo: "gestor",
  },
  {
    id: "Miguel Rodriguez",
    nombre: "Miguel Rodriguez",
    tipo: "supervisor",
  },
];

export default function SelectorGestorWhatsapp({ valor, onChange }: Props) {
  return (
    <div className="min-w-0">
      <label className="whatsapp-label">Gestor</label>

      <div className="mt-1 flex items-center gap-2">
        <div
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: "var(--color-borde)",
            background: "var(--color-fondo-sutil)",
            color: "var(--color-texto-suave)",
          }}
        >
          <UserRound size={18} />
        </div>

        <select
          value={valor}
          onChange={(event) => onChange(event.target.value)}
          className="whatsapp-select h-[52px] min-w-0 flex-1"
        >
          <option value="">Todos los gestores</option>

          {GESTORES.map((gestor) => (
            <option key={gestor.id} value={gestor.id}>
              {gestor.nombre}
              {gestor.tipo === "supervisor" ? " (Supervisor)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!valor && (
        <p
          className="mt-1 text-[11px]"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          Se mostrarán clientes de todas las carteras.
        </p>
      )}
    </div>
  );
}
