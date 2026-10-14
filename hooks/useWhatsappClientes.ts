"use client";
import { useEffect, useState } from "react";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";
import type { FiltroSeguimientoWhatsapp } from "@/lib/whatsapp/seguimiento";
type Props = {
  campana: string;
  desde: string;
  hasta: string;
  gestor?: string;
  busqueda?: string;
  vista?: "recientes" | "todos";
  activo?: boolean;
  campanaId?: number | null;
  seguimiento?: FiltroSeguimientoWhatsapp;
  refresco?: number;
};
export function useWhatsappClientes({
  campana,
  desde,
  hasta,
  gestor = "",
  busqueda = "",
  vista = "recientes",
  activo = true,
  campanaId = null,
  seguimiento = "TODOS",
  refresco = 0,
}: Props) {
  const [clientes, setClientes] = useState<ClienteWhatsapp[]>([]),
    [total, setTotal] = useState(0),
    [cargando, setCargando] = useState(activo),
    [error, setError] = useState("");
  useEffect(() => {
    if (!activo) return;
    const controller = new AbortController();
    let pendiente = false;
    let primera = true;
    const params = new URLSearchParams({
      campana,
      vista,
      desde,
      hasta,
      seguimiento,
    });
    if (gestor) params.set("gestor", gestor);
    if (busqueda.trim()) params.set("q", busqueda.trim());
    if (campanaId) params.set("campanaId", String(campanaId));
    async function cargar() {
      if (pendiente || controller.signal.aborted) return;
      pendiente = true;
      if (primera) {
        setCargando(true);
        primera = false;
      }
      try {
        const r = await fetch("/api/whatsapp/clientes?" + params, {
          cache: "no-store",
          signal: controller.signal,
        });
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error ?? "No se pudieron cargar los clientes.");
        if (!controller.signal.aborted) {
          setClientes(d.clientes ?? []);
          setTotal(d.total ?? 0);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setClientes([]);
          setTotal(0);
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los clientes.",
          );
        }
      } finally {
        pendiente = false;
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    const timer = setTimeout(() => void cargar(), 300);
    const intervalo = campanaId ? setInterval(() => void cargar(), 3000) : null;
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (intervalo) clearInterval(intervalo);
    };
  }, [
    activo,
    campana,
    desde,
    hasta,
    gestor,
    busqueda,
    vista,
    campanaId,
    seguimiento,
    refresco,
  ]);
  return { clientes, total, cargando, error };
}
