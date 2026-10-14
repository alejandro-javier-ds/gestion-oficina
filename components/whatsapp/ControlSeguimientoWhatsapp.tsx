"use client";

import { useEffect, useRef, useState } from "react";
import type { CampanaGuardadaWhatsapp } from "@/lib/whatsapp/campanas";
import type { FiltroSeguimientoWhatsapp } from "@/lib/whatsapp/seguimiento";
import { formatearFechaLima } from "@/lib/fecha-lima";

export type ConfirmacionesWhatsapp = {
  confirmarSeguimientos: boolean;
  confirmarReintentos: boolean;
  confirmarResultadosRevisados: boolean;
};
export const SIN_CONFIRMACIONES_WHATSAPP: ConfirmacionesWhatsapp = {
  confirmarSeguimientos: false,
  confirmarReintentos: false,
  confirmarResultadosRevisados: false,
};
export function ControlSeguimientoWhatsapp({
  modulo,
  valor,
  onChange,
  filtro,
  onFiltro,
  version,
  disabled,
  onPendientes,
  onRevisar,
}: {
  modulo: "gestiones" | "pdps";
  valor: number | null;
  onChange: (campana: CampanaGuardadaWhatsapp | null) => void;
  filtro: FiltroSeguimientoWhatsapp;
  onFiltro: (filtro: FiltroSeguimientoWhatsapp) => void;
  version: number;
  disabled?: boolean;
  onPendientes: () => void;
  onRevisar: () => void;
}) {
  const [campanas, setCampanas] = useState<CampanaGuardadaWhatsapp[]>([]);
  const [error, setError] = useState("");
  const restaurado = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/whatsapp/historial?modulo=${modulo}&limite=200`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.error ?? "No se pudieron cargar las campañas.");
        if (controller.signal.aborted) return;
        setCampanas(data.campanas ?? []);
        setError("");
        if (!restaurado.current) {
          const id = Number(
            new URL(window.location.href).searchParams.get(
              modulo === "pdps" ? "campanaPdp" : "campanaGestiones",
            ),
          );
          if (id > 0) {
            let guardada = (data.campanas as CampanaGuardadaWhatsapp[]).find(
              (c) => c.id === id,
            );
            if (!guardada) {
              const respuesta = await fetch(
                `/api/whatsapp/historial?id=${id}`,
                { cache: "no-store", signal: controller.signal },
              );
              if (respuesta.ok) guardada = (await respuesta.json()).campana;
            }
            if (
              !controller.signal.aborted &&
              !restaurado.current &&
              guardada &&
              guardada.campana.startsWith("PDP - ") === (modulo === "pdps")
            )
              onChange(guardada);
          }
          if (!controller.signal.aborted) restaurado.current = true;
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las campañas.",
          );
      });
    return () => controller.abort();
  }, [modulo, version, onChange]);
  return (
    <section className="tarjeta space-y-3 p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium">
          Campaña en seguimiento
          <select
            aria-label={`Campaña en seguimiento ${modulo}`}
            className="whatsapp-select mt-1"
            value={valor ?? ""}
            disabled={disabled}
            onChange={(e) => {
              restaurado.current = true;
              const campana =
                campanas.find((c) => c.id === Number(e.target.value)) ?? null;
              const url = new URL(window.location.href);
              const clave =
                modulo === "pdps" ? "campanaPdp" : "campanaGestiones";
              if (campana) url.searchParams.set(clave, String(campana.id));
              else url.searchParams.delete(clave);
              window.history.replaceState(null, "", url);
              onChange(campana);
            }}
          >
            <option value="">Nueva campaña</option>
            {valor && !campanas.some((c) => c.id === valor) && (
              <option value={valor}>Campaña #{valor}</option>
            )}
            {campanas.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} · {c.campana} · {formatearFechaLima(c.fecha_creacion)} ·{" "}
                {c.estado}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Estado de clientes
          <select
            className="whatsapp-select mt-1"
            value={filtro}
            disabled={disabled}
            onChange={(e) =>
              onFiltro(e.target.value as FiltroSeguimientoWhatsapp)
            }
          >
            <option value="TODOS">Todos los clientes</option>
            <option value="COMPLETADO">Completados</option>
            <option value="PARCIAL">Parciales</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="REVISAR">Con errores</option>
            <option value="SIN_EXITO">Números sin envío exitoso</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="boton-secundario"
          disabled={disabled}
          onClick={onPendientes}
        >
          Seleccionar solo teléfonos pendientes
        </button>
        {valor && (
          <button
            type="button"
            className="boton-secundario"
            disabled={disabled}
            onClick={onRevisar}
          >
            Revisar selección guardada
          </button>
        )}
      </div>
      <p className="text-xs" style={{ color: "var(--color-texto-suave)" }}>
        El avance pertenece a la campaña elegida. Un envío de otra campaña no
        completa esta. Enviado no acredita entrega, lectura ni gestión de
        cobranza.
      </p>
      {error && (
        <p
          role="alert"
          className="text-sm"
          style={{ color: "var(--color-error)" }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
export function ConfirmarSeguimientosWhatsapp({
  anteriores,
  fallidos,
  inciertos,
  valor,
  onChange,
  disabled,
}: {
  anteriores: boolean;
  fallidos: boolean;
  inciertos: boolean;
  valor: ConfirmacionesWhatsapp;
  onChange: (valor: ConfirmacionesWhatsapp) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="space-y-3 rounded border p-3 text-sm"
      style={{
        borderColor: "var(--color-borde)",
        background: "var(--color-fondo-sutil)",
      }}
    >
      {anteriores && (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            disabled={disabled}
            checked={valor.confirmarSeguimientos}
            onChange={(e) =>
              onChange({ ...valor, confirmarSeguimientos: e.target.checked })
            }
          />
          <span>
            Hay teléfonos con envíos exitosos en otras campañas. Confirmo que
            deseo realizar un nuevo seguimiento.
          </span>
        </label>
      )}
      {fallidos && (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            disabled={disabled}
            checked={valor.confirmarReintentos}
            onChange={(e) =>
              onChange({ ...valor, confirmarReintentos: e.target.checked })
            }
          />
          <span>
            Revisé los teléfonos fallidos y autorizo un nuevo intento. Los
            intentos anteriores se conservarán.
          </span>
        </label>
      )}
      {inciertos && (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            disabled={disabled}
            checked={valor.confirmarResultadosRevisados}
            onChange={(e) =>
              onChange({
                ...valor,
                confirmarResultadosRevisados: e.target.checked,
              })
            }
          />
          <span>
            Revisé WhatsApp y confirmé que los envíos anteriores inciertos no se
            realizaron. Autorizo este seguimiento nuevo.
          </span>
        </label>
      )}
      {!anteriores && !fallidos && !inciertos && (
        <p>
          Solo se enviará a los teléfonos que aparecen seleccionados en esta
          revisión.
        </p>
      )}
    </div>
  );
}
