// components/whatsapp/BarraClientesWhatsapp.tsx
// Buscador, pestañas de trabajo y botón para abrir todos los clientes.

"use client";

import { Search } from "lucide-react";

type Props = {
  busqueda: string;
  onBusqueda: (valor: string) => void;
  recientes: number;
  total: number;
  seleccionados: number;
  rango: string;
  onVerMas: () => void;
};

export default function BarraClientesWhatsapp({
  busqueda,
  onBusqueda,
  recientes,
  total,
  seleccionados,
  rango,
  onVerMas,
}: Props) {
  return (
    <section className="tarjeta p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="buscar-whatsapp"
            className="mb-1.5 block text-sm font-semibold"
          >
            Buscar clientes
          </label>

          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-texto-suave)" }}
            />

            <input
              id="buscar-whatsapp"
              type="text"
              value={busqueda}
              onChange={(e) => onBusqueda(e.target.value)}
              placeholder="Buscar por nombre, IDC, DNI o teléfono..."
              className="whatsapp-buscador"
            />
          </div>
        </div>

        <button
          type="button"
          className="boton-secundario shrink-0"
          onClick={onVerMas}
        >
          Ver más clientes
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip chip-neutral">{recientes} recientes</span>

        <span className="chip chip-neutral">{total} encontrados</span>

        <span className="chip chip-neutral">{rango}</span>

        <span className="chip chip-accion">{seleccionados} seleccionados</span>
      </div>
    </section>
  );
}
