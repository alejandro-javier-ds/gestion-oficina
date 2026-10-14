"use client";
import { useCallback, useState } from "react";
export type MetadataWhatsappSeleccion = { campana: string; cliente?: unknown };
export function useWhatsappSeleccion() {
  const [estado, setEstado] = useState<{
    ids: string[];
    metadata: Record<string, MetadataWhatsappSeleccion>;
  }>({ ids: [], metadata: {} });
  const toggle = useCallback(
    (id: string, metadata?: MetadataWhatsappSeleccion) => {
      setEstado((actual) => {
        const datos = { ...actual.metadata };
        if (actual.ids.includes(id)) {
          delete datos[id];
          return { ids: actual.ids.filter((i) => i !== id), metadata: datos };
        }
        if (metadata) datos[id] = metadata;
        return { ids: [...actual.ids, id], metadata: datos };
      });
    },
    [],
  );
  const toggleMuchos = useCallback(
    (
      ids: string[],
      metadata: Record<string, MetadataWhatsappSeleccion> = {},
    ) => {
      if (!ids.length) return;
      setEstado((actual) => {
        const quitar = ids.every((id) => actual.ids.includes(id));
        const datos = { ...actual.metadata };
        for (const id of ids) {
          if (quitar) delete datos[id];
          else if (metadata[id]) datos[id] = metadata[id];
        }
        return {
          ids: quitar
            ? actual.ids.filter((id) => !ids.includes(id))
            : [...new Set([...actual.ids, ...ids])],
          metadata: datos,
        };
      });
    },
    [],
  );
  const seleccionar = useCallback(
    (
      ids: string[],
      metadata: Record<string, MetadataWhatsappSeleccion> = {},
    ) => {
      setEstado((actual) => ({
        ids: [...new Set([...actual.ids, ...ids])],
        metadata: { ...actual.metadata, ...metadata },
      }));
    },
    [],
  );
  const limpiar = useCallback(() => setEstado({ ids: [], metadata: {} }), []);
  const obtenerMetadata = useCallback(
    (id: string) => estado.metadata[id],
    [estado.metadata],
  );
  return {
    seleccionados: estado.ids,
    cantidad: estado.ids.length,
    toggle,
    toggleMuchos,
    seleccionar,
    limpiar,
    estaSeleccionado: (id: string) => estado.ids.includes(id),
    metadataPorCliente: estado.metadata,
    obtenerMetadata,
  };
}
