// components/whatsapp/VistaPreviaWhatsapp.tsx
// Vista previa y edición del mensaje final de un destinatario.
// Solo Frontend.

"use client";

import { Eye, RotateCcw, X } from "lucide-react";

import type { ClienteWhatsapp } from "./FilaClienteWhatsapp";

type Props = {
  cliente: ClienteWhatsapp | null;
  numeroSalida: string;
  numeroDestino: string;
  mensaje: string;
  editable?: boolean;
  etiquetaSegmentacion?: string;
  onMensajeChange?: (mensaje: string) => void;
  onRestaurar?: () => void;
  onCerrar: () => void;
};

export default function VistaPreviaWhatsapp({
  cliente,
  numeroSalida,
  numeroDestino,
  mensaje,
  editable = false,
  etiquetaSegmentacion = "Segmentación",
  onMensajeChange,
  onRestaurar,
  onCerrar,
}: Props) {
  if (!cliente) {
    return (
      <section className="tarjeta p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Vista previa</h2>

          <p
            className="mt-1 text-xs"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            Selecciona un cliente para revisar su mensaje.
          </p>
        </div>

        <div
          className="flex min-h-[170px] items-center justify-center rounded-lg"
          style={{
            background: "var(--color-fondo-sutil)",
            border: "1px dashed var(--color-borde-fuerte)",
          }}
        >
          <div className="text-center">
            <Eye
              size={20}
              className="mx-auto mb-2"
              style={{
                color: "var(--color-texto-tenue)",
              }}
            />

            <p
              className="text-sm font-medium"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Selecciona un cliente para revisar su mensaje
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta overflow-hidden">
      <div
        className="flex items-start justify-between gap-3 border-b p-4 sm:p-5"
        style={{
          borderColor: "var(--color-borde)",
        }}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Vista previa</h2>

          <p
            className="mt-1 truncate text-sm"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            {cliente.cliente}
          </p>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="rounded-md p-1.5"
          style={{
            color: "var(--color-texto-suave)",
          }}
          aria-label="Cerrar vista previa"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="whatsapp-label">Desde</p>

          <p className="mt-1 text-sm font-medium dato-numerico">
            {numeroSalida || "Sin seleccionar"}
          </p>
        </div>

        <div>
          <p className="whatsapp-label">Destino</p>

          <p className="mt-1 text-sm font-medium dato-numerico">
            {numeroDestino || "Sin seleccionar"}
          </p>
        </div>

        <div>
          <p className="whatsapp-label">{etiquetaSegmentacion}</p>

          <span className="mt-1 chip chip-accion">
            {cliente.segmentacion ?? "Sin segmentación"}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Mensaje</h3>

            <p
              className="mt-1 text-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              {editable
                ? "Puedes modificar únicamente el mensaje de este cliente."
                : "Mensaje final generado para este destinatario."}
            </p>
          </div>

          {editable && onRestaurar && (
            <button
              type="button"
              className="boton-secundario inline-flex shrink-0 items-center gap-2"
              onClick={onRestaurar}
            >
              <RotateCcw size={14} />
              Restaurar
            </button>
          )}
        </div>

        {editable ? (
          <textarea
            value={mensaje}
            onChange={(event) => onMensajeChange?.(event.target.value)}
            rows={9}
            className="input-estandar w-full resize-y"
            spellCheck
          />
        ) : (
          <div className="whatsapp-vista-previa">
            <div className="whatsapp-mensaje whitespace-pre-wrap">
              {mensaje}
            </div>
          </div>
        )}

        <div
          className="mt-2 text-right text-xs"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          {mensaje.length} caracteres
        </div>
      </div>
    </section>
  );
}
