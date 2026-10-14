"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";
import { normalizarCelularWhatsapp } from "@/lib/whatsapp/seguimiento";

type NumeroWhatsappRegistrado = {
  numero: string;
  propietario: string;
  propietarioTipo?: string;
  activo?: number;
};
function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
export function useWhatsappTelefonos(activo = true) {
  const [numerosWhatsappRegistrados, setNumerosWhatsappRegistrados] = useState<
    NumeroWhatsappRegistrado[]
  >([]);
  const [telefonosSeleccionados, setTelefonosSeleccionados] = useState<
    Record<string, string[]>
  >({});
  const [telefonosManuales, setTelefonosManuales] = useState<
    Record<string, string[]>
  >({});
  useEffect(() => {
    if (!activo) return;
    const controller = new AbortController();
    let cargando = false;
    async function cargar() {
      if (cargando || controller.signal.aborted) return;
      cargando = true;
      try {
        const r = await fetch("/api/whatsapp/playwright/estados", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) return;
        const data = await r.json();
        if (!controller.signal.aborted)
          setNumerosWhatsappRegistrados(data.numeros ?? []);
      } catch {
      } finally {
        cargando = false;
      }
    }
    void cargar();
    const timer = window.setInterval(() => void cargar(), 10000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [activo]);
  const cambiarTelefono = useCallback((id: string, entrada: string) => {
    const numero = normalizarCelularWhatsapp(entrada);
    if (!numero) return;
    setTelefonosSeleccionados((actuales) => {
      const seleccion = actuales[id] ?? [];
      return {
        ...actuales,
        [id]: seleccion.includes(numero)
          ? seleccion.filter((n) => n !== numero)
          : [...seleccion, numero],
      };
    });
  }, []);
  const seleccionarTelefonos = useCallback((id: string, numeros: string[]) => {
    setTelefonosSeleccionados((actuales) => ({
      ...actuales,
      [id]: [
        ...new Set(numeros.map(normalizarCelularWhatsapp).filter(Boolean)),
      ],
    }));
  }, []);
  const agregarTelefonoManual = useCallback((id: string, entrada: string) => {
    const numero = normalizarCelularWhatsapp(entrada);
    if (!numero)
      throw new Error("Ingresa un celular peruano válido de nueve dígitos.");
    setTelefonosManuales((actuales) => ({
      ...actuales,
      [id]: [...new Set([...(actuales[id] ?? []), numero])],
    }));
    setTelefonosSeleccionados((actuales) => ({
      ...actuales,
      [id]: [...new Set([...(actuales[id] ?? []), numero])],
    }));
  }, []);
  const limpiarTelefonos = useCallback(() => {
    setTelefonosSeleccionados({});
    setTelefonosManuales({});
  }, []);
  const telefonoDestino = useCallback(
    (cliente: ClienteWhatsapp) =>
      (telefonosSeleccionados[cliente.id] ?? []).join(" · "),
    [telefonosSeleccionados],
  );
  const obtenerNumeroContactoGestor = useCallback(
    (gestorCliente: string) => {
      const nombre = normalizarTexto(gestorCliente);
      return nombre
        ? (numerosWhatsappRegistrados.find(
            (n) => n.activo !== 0 && normalizarTexto(n.propietario) === nombre,
          )?.numero ?? "")
        : "";
    },
    [numerosWhatsappRegistrados],
  );
  return {
    numerosWhatsappRegistrados,
    telefonosSeleccionados,
    telefonosManuales,
    cambiarTelefono,
    seleccionarTelefonos,
    agregarTelefonoManual,
    limpiarTelefonos,
    telefonoDestino,
    obtenerNumeroContactoGestor,
  };
}
