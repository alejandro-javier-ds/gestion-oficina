// hooks/useWhatsappClientes.ts
// Carga clientes para WhatsApp aplicando campaña,
// fechas, gestor y búsqueda.

"use client";

import { useEffect, useState } from "react";

import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";

type Props = {
  campana: string;
  desde: string;
  hasta: string;
  gestor?: string;
  busqueda?: string;
  vista?: "recientes" | "todos";
  activo?: boolean;
};

type Resultado = {
  clientes: ClienteWhatsapp[];
  total: number;
  cargando: boolean;
  error: string;
};

export function useWhatsappClientes({
  campana,
  desde,
  hasta,
  gestor = "",
  busqueda = "",
  vista = "recientes",
  activo = true,
}: Props): Resultado {
  const [clientes, setClientes] = useState<ClienteWhatsapp[]>([]);

  const [total, setTotal] = useState(0);

  const [cargando, setCargando] = useState(activo);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!activo) {
      setClientes([]);
      setTotal(0);
      setCargando(false);
      setError("");
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setCargando(true);
        setError("");

        const params = new URLSearchParams({
          campana,
          vista,
          desde,
          hasta,
        });

        if (gestor) {
          params.set("gestor", gestor);
        }

        if (busqueda.trim()) {
          params.set("q", busqueda.trim());
        }

        const response = await fetch(
          `/api/whatsapp/clientes?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudieron cargar los clientes.");
        }

        setClientes(data.clientes ?? []);

        setTotal(data.total ?? 0);
      } catch (err) {
        setClientes([]);
        setTotal(0);

        setError(
          err instanceof Error ? err.message : "Error al cargar los clientes.",
        );
      } finally {
        setCargando(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activo, campana, desde, hasta, gestor, busqueda, vista]);

  return {
    clientes,
    total,
    cargando,
    error,
  };
}
