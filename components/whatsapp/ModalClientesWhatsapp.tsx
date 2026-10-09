// components/whatsapp/ModalClientesWhatsapp.tsx
// Ventana para consultar y seleccionar todos los clientes.
// La selección se mantiene al cambiar búsquedas.
// También respeta los filtros de campaña, fechas y gestor.

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { ClienteWhatsapp } from "./FilaClienteWhatsapp";
import TablaClientesWhatsapp from "./TablaClientesWhatsapp";
import { useWhatsappClientes } from "@/hooks/useWhatsappClientes";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  campana: string;
  desde: string;
  hasta: string;
  gestor: string;
  seleccionados: string[];
  onToggle: (id: string) => void;
  onToggleMuchos: (ids: string[]) => void;
  telefonosSeleccionados: Record<string, string>;
  telefonosManuales: Record<string, string>;
  usarTelefonoManual: Record<string, boolean>;
  onTelefono: (id: string, telefonoId: string) => void;
  onTelefonoManual: (id: string, valor: string) => void;
  onUsarManual: (id: string) => void;
  onVolverRegistrado: (id: string) => void;
  onVistaPrevia: (cliente: ClienteWhatsapp) => void;
};

export default function ModalClientesWhatsapp({
  abierto,
  onCerrar,
  campana,
  desde,
  hasta,
  gestor,
  seleccionados,
  onToggle,
  onToggleMuchos,
  telefonosSeleccionados,
  telefonosManuales,
  usarTelefonoManual,
  onTelefono,
  onTelefonoManual,
  onUsarManual,
  onVolverRegistrado,
  onVistaPrevia,
}: Props) {
  const [busqueda, setBusqueda] = useState("");

  const { clientes, total, cargando, error } = useWhatsappClientes({
    campana,
    desde,
    hasta,
    gestor,
    busqueda,
    vista: "todos",
    activo: abierto,
  });

  useEffect(() => {
    if (!abierto) {
      setBusqueda("");
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    const overflowOriginal = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, [abierto]);

  if (!abierto) {
    return null;
  }

  const idsVisibles = clientes.map((cliente) => cliente.id);

  const todosVisiblesSeleccionados =
    idsVisibles.length > 0 &&
    idsVisibles.every((id) => seleccionados.includes(id));

  function alternarSeleccionVisibles() {
    onToggleMuchos(idsVisibles);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div
        className="flex h-[calc(100vh-24px)] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl sm:h-[calc(100vh-40px)]"
        style={{
          background: "var(--color-superficie)",
          boxShadow: "var(--sombra-lg)",
        }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b p-4 sm:p-5"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold sm:text-lg">
              Todos los clientes
            </h2>

            <p
              className="mt-1 text-xs sm:text-sm"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Busca y selecciona destinatarios sin perder las selecciones
              anteriores.
            </p>

            {gestor && (
              <p
                className="mt-1 text-xs font-medium"
                style={{
                  color: "var(--color-accion)",
                }}
              >
                Gestor: {gestor}
              </p>
            )}
          </div>

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{
              color: "var(--color-texto-suave)",
            }}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-neutral">{total} clientes</span>

            <span className="chip chip-accion">
              {seleccionados.length} seleccionados
            </span>
          </div>

          <button
            type="button"
            className="boton-secundario shrink-0"
            disabled={!clientes.length}
            onClick={alternarSeleccionVisibles}
          >
            {todosVisiblesSeleccionados
              ? "Quitar visibles"
              : "Seleccionar visibles"}
          </button>
        </div>

        <div
          className="border-b p-4 sm:p-5"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <input
            type="text"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, IDC, DNI o teléfono..."
            className="whatsapp-buscador"
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <TablaClientesWhatsapp
            clientes={clientes}
            seleccionados={seleccionados}
            cargando={cargando}
            error={error}
            onToggle={onToggle}
            onTelefono={onTelefono}
            onTelefonoManual={onTelefonoManual}
            onUsarManual={onUsarManual}
            onVolverRegistrado={onVolverRegistrado}
            onVistaPrevia={onVistaPrevia}
            telefonosSeleccionados={telefonosSeleccionados}
            telefonosManuales={telefonosManuales}
            usarTelefonoManual={usarTelefonoManual}
            vacio="No se encontraron clientes."
          />
        </div>

        <div
          className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <div>
            <span className="text-sm font-semibold">
              {seleccionados.length} seleccionados
            </span>

            <p
              className="mt-1 text-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Las selecciones se conservan aunque cambies la búsqueda.
            </p>
          </div>

          <button type="button" className="boton-primario" onClick={onCerrar}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
