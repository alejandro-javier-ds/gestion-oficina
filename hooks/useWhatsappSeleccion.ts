// hooks/useWhatsappSeleccion.ts
// Maneja la selección persistente de destinatarios.
// La selección NO se pierde al cambiar de campaña.

"use client";

import { useState } from "react";

export type MetadataWhatsappSeleccion = {
  campana: string;
  cliente?: unknown;
};

export function useWhatsappSeleccion() {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  const [metadataPorCliente, setMetadataPorCliente] = useState<
    Record<string, MetadataWhatsappSeleccion>
  >({});

  function toggle(id: string, metadata?: MetadataWhatsappSeleccion) {
    setSeleccionados((actuales) => {
      const existe = actuales.includes(id);

      if (existe) {
        setMetadataPorCliente((metadatos) => {
          const nuevos = { ...metadatos };
          delete nuevos[id];
          return nuevos;
        });

        return actuales.filter((item) => item !== id);
      }

      if (metadata) {
        setMetadataPorCliente((metadatos) => ({
          ...metadatos,
          [id]: metadata,
        }));
      }

      return [...actuales, id];
    });
  }

  function toggleMuchos(
    ids: string[],
    metadataPorId: Record<string, MetadataWhatsappSeleccion> = {},
  ) {
    if (!ids.length) return;

    setSeleccionados((actuales) => {
      const todosSeleccionados = ids.every((id) => actuales.includes(id));

      if (todosSeleccionados) {
        setMetadataPorCliente((metadatos) => {
          const nuevos = {
            ...metadatos,
          };

          ids.forEach((id) => delete nuevos[id]);

          return nuevos;
        });

        return actuales.filter((id) => !ids.includes(id));
      }

      const nuevosIds = ids.filter((id) => !actuales.includes(id));

      if (nuevosIds.length) {
        setMetadataPorCliente((metadatos) => {
          const nuevos = {
            ...metadatos,
          };

          nuevosIds.forEach((id) => {
            const metadata = metadataPorId[id];

            if (metadata) {
              nuevos[id] = metadata;
            }
          });

          return nuevos;
        });
      }

      return [...new Set([...actuales, ...ids])];
    });
  }

  function limpiar() {
    setSeleccionados([]);
    setMetadataPorCliente({});
  }

  function estaSeleccionado(id: string) {
    return seleccionados.includes(id);
  }

  function obtenerMetadata(id: string) {
    return metadataPorCliente[id];
  }

  return {
    seleccionados,
    cantidad: seleccionados.length,
    toggle,
    toggleMuchos,
    limpiar,
    estaSeleccionado,
    metadataPorCliente,
    obtenerMetadata,
  };
}
