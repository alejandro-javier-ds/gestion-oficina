// hooks/useWhatsappTelefonos.ts

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";

type NumeroWhatsappRegistrado = {
  numero: string;
  propietario: string;
  propietarioTipo?: string;
  activo?: number;
};

type Resultado = {
  numerosWhatsappRegistrados: NumeroWhatsappRegistrado[];
  telefonosSeleccionados: Record<string, string>;
  telefonosManuales: Record<string, string>;
  usarTelefonoManual: Record<string, boolean>;
  cambiarTelefono: (id: string, telefonoId: string) => void;
  cambiarTelefonoManual: (id: string, valor: string) => void;
  usarManual: (id: string) => void;
  volverRegistrado: (id: string) => void;
  telefonoDestino: (cliente: ClienteWhatsapp) => string;
  obtenerNumeroContactoGestor: (gestorCliente: string) => string;
};

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function useWhatsappTelefonos(): Resultado {
  const [numerosWhatsappRegistrados, setNumerosWhatsappRegistrados] = useState<
    NumeroWhatsappRegistrado[]
  >([]);
  const [telefonosSeleccionados, setTelefonosSeleccionados] = useState<
    Record<string, string>
  >({});
  const [telefonosManuales, setTelefonosManuales] = useState<
    Record<string, string>
  >({});
  const [usarTelefonoManual, setUsarTelefonoManual] = useState<
    Record<string, boolean>
  >({});

  const cargarNumerosWhatsapp = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/whatsapp/playwright/estados", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        numeros?: NumeroWhatsappRegistrado[];
      };

      setNumerosWhatsappRegistrados(data.numeros ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNumerosWhatsappRegistrados([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void cargarNumerosWhatsapp(controller.signal);

    const intervalo = window.setInterval(() => {
      void cargarNumerosWhatsapp();
    }, 10_000);

    return () => {
      controller.abort();
      window.clearInterval(intervalo);
    };
  }, [cargarNumerosWhatsapp]);

  const cambiarTelefono = useCallback((id: string, telefonoId: string) => {
    setTelefonosSeleccionados((actuales) => ({
      ...actuales,
      [id]: telefonoId,
    }));
  }, []);

  const cambiarTelefonoManual = useCallback((id: string, valor: string) => {
    setTelefonosManuales((actuales) => ({
      ...actuales,
      [id]: valor,
    }));
  }, []);

  const usarManual = useCallback((id: string) => {
    setUsarTelefonoManual((actuales) => ({
      ...actuales,
      [id]: true,
    }));
  }, []);

  const volverRegistrado = useCallback((id: string) => {
    setUsarTelefonoManual((actuales) => ({
      ...actuales,
      [id]: false,
    }));
  }, []);

  const telefonoDestino = useCallback(
    (cliente: ClienteWhatsapp): string => {
      if (usarTelefonoManual[cliente.id]) {
        return telefonosManuales[cliente.id] ?? "";
      }

      const seleccionado = telefonosSeleccionados[cliente.id];

      if (seleccionado) {
        return (
          cliente.telefonos.find(
            (telefono) => String(telefono.id_phone) === seleccionado,
          )?.phone ?? ""
        );
      }

      return (
        cliente.telefonos.find(
          (telefono) =>
            telefono.activo === 1 &&
            telefono.tipo_telefono.toLowerCase() === "celular",
        )?.phone ?? ""
      );
    },
    [telefonosManuales, telefonosSeleccionados, usarTelefonoManual],
  );

  const obtenerNumeroContactoGestor = useCallback(
    (gestorCliente: string): string => {
      const gestorNormalizado = normalizarTexto(gestorCliente);

      if (!gestorNormalizado) return "";

      const numeroGestor = numerosWhatsappRegistrados.find((item) => {
        if (item.activo === 0) return false;

        const propietarioNormalizado = normalizarTexto(item.propietario);

        return propietarioNormalizado === gestorNormalizado;
      });

      return numeroGestor?.numero ?? "";
    },
    [numerosWhatsappRegistrados],
  );

  return {
    numerosWhatsappRegistrados,
    telefonosSeleccionados,
    telefonosManuales,
    usarTelefonoManual,
    cambiarTelefono,
    cambiarTelefonoManual,
    usarManual,
    volverRegistrado,
    telefonoDestino,
    obtenerNumeroContactoGestor,
  };
}
