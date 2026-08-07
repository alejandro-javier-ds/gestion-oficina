// components/whatsapp/ResumenEnvioWhatsapp.tsx
// Resumen de la configuración de la campaña antes de preparar.
// El número de salida es obligatorio.

"use client";

import { CheckCircle2, MessageCircle, Send, Phone } from "lucide-react";

type Props = {
  seleccionados: number;
  campaña: string;
  gestor: string;
  rango: string;
  numeroSalida: string;
  onPreparar: () => void;
};

function mostrarNumero(numero: string): string {
  const limpio = numero.trim();

  if (!limpio) {
    return "Sin seleccionar";
  }

  if (limpio.startsWith("+")) {
    return limpio;
  }

  return `+51 ${limpio}`;
}

export default function ResumenEnvioWhatsapp({
  seleccionados,
  campaña,
  gestor,
  rango,
  numeroSalida,
  onPreparar,
}: Props) {
  const numeroValido = numeroSalida.trim() !== "";

  const puedePreparar = seleccionados > 0 && numeroValido;

  return (
    <section className="tarjeta overflow-hidden">
      <div
        className="flex items-center gap-3 border-b px-4 py-4 sm:px-5"
        style={{
          borderColor: "var(--color-borde)",
        }}
      >
        <div className="whatsapp-icono">
          <MessageCircle size={18} />
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-semibold">Resumen del envío</h2>

          <p
            className="mt-1 text-xs sm:text-sm"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            Revisa la configuración antes de preparar la campaña.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4">
        <div
          className="border-b p-4 xl:border-b-0 xl:border-r"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <p className="text-xs font-medium whatsapp-label">Campaña</p>

          <p className="mt-1 truncate text-sm font-semibold">
            {campaña || "Sin seleccionar"}
          </p>
        </div>

        <div
          className="border-b p-4 xl:border-b-0 xl:border-r"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <p className="text-xs font-medium whatsapp-label">Gestor</p>

          <p className="mt-1 truncate text-sm font-semibold">
            {gestor || "Todos los gestores"}
          </p>
        </div>

        <div
          className="border-b p-4 xl:border-b-0 xl:border-r"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <p className="text-xs font-medium whatsapp-label">Periodo</p>

          <p className="mt-1 truncate text-sm font-semibold">
            {rango || "Sin seleccionar"}
          </p>
        </div>

        <div
          className="border-b p-4 xl:border-b-0"
          style={{
            borderColor: numeroValido
              ? "var(--color-borde)"
              : "var(--color-alerta)",
            background: numeroValido
              ? "transparent"
              : "var(--color-alerta-suave)",
          }}
        >
          <div className="flex items-center gap-2">
            <Phone
              size={15}
              style={{
                color: numeroValido
                  ? "var(--color-texto-suave)"
                  : "var(--color-alerta)",
              }}
            />

            <p className="text-xs font-medium whatsapp-label">
              Número de salida
            </p>
          </div>

          <p
            className="mt-1 truncate text-sm font-semibold dato-numerico"
            style={{
              color: numeroValido
                ? "var(--color-texto)"
                : "var(--color-alerta)",
            }}
            title={numeroValido ? mostrarNumero(numeroSalida) : undefined}
          >
            {mostrarNumero(numeroSalida)}
          </p>

          {!numeroValido && (
            <p
              className="mt-1 text-[11px] font-medium"
              style={{
                color: "var(--color-alerta)",
              }}
            >
              Debes seleccionar un número de salida.
            </p>
          )}
        </div>
      </div>

      <div
        className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        style={{
          borderTop: "1px solid var(--color-borde)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background:
                seleccionados > 0
                  ? "var(--color-exito-suave)"
                  : "var(--color-fondo-sutil)",
              color:
                seleccionados > 0
                  ? "var(--color-exito)"
                  : "var(--color-texto-suave)",
            }}
          >
            <CheckCircle2 size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold">
              {seleccionados} seleccionados
            </p>

            <p
              className="mt-1 text-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              {seleccionados <= 0
                ? "Selecciona al menos un cliente para continuar."
                : !numeroValido
                  ? "Selecciona un número de salida para continuar."
                  : "La campaña está lista para ser preparada."}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="boton-primario inline-flex items-center justify-center gap-2"
          disabled={!puedePreparar}
          onClick={onPreparar}
          title={
            !numeroValido
              ? "Selecciona un número de salida antes de preparar el envío."
              : seleccionados <= 0
                ? "Selecciona al menos un cliente."
                : undefined
          }
        >
          <Send size={16} />
          Preparar envío
        </button>
      </div>
    </section>
  );
}
