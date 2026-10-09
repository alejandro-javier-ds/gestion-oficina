// components/whatsapp/EstadoEnvioWhatsapp.tsx
// Estado y progreso de preparación y envío de una campaña.
// La preparación valida destinatarios; el envío actualiza el progreso real.

"use client";

import { CheckCircle2, Clock3, Loader2, Send, XCircle } from "lucide-react";

type Props = {
  abierto: boolean;
  campaña: string;
  gestor: string;
  numeroSalida: string;
  total: number;
  procesados: number;
  preparados: number;
  sinTelefono: number;
  fallidos: number;
  preparando: boolean;
  enviando?: boolean;
  onCerrar: () => void;
};

export default function EstadoEnvioWhatsapp({
  abierto,
  campaña,
  gestor,
  numeroSalida,
  total,
  procesados,
  preparados,
  sinTelefono,
  fallidos,
  preparando,
  enviando = false,
  onCerrar,
}: Props) {
  if (!abierto) {
    return null;
  }

  const enProceso = preparando || enviando;

  const progreso =
    total > 0 ? Math.min(100, Math.round((procesados / total) * 100)) : 0;

  const pendientes = Math.max(0, total - procesados);

  const problemas = sinTelefono + fallidos;

  const titulo = preparando
    ? "Preparando campaña"
    : enviando
      ? "Enviando campaña"
      : "Campaña preparada";

  const descripcion = preparando
    ? "Validando los destinatarios seleccionados."
    : enviando
      ? `Enviando mensajes: ${procesados} de ${total} procesados.`
      : "La preparación terminó. Todavía no se ha enviado ningún mensaje.";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !enProceso) {
          onCerrar();
        }
      }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl"
        style={{
          background: "var(--color-superficie)",
          boxShadow: "var(--sombra-lg)",
        }}
      >
        <div
          className="border-b p-5"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="whatsapp-icono">
              {enProceso ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold sm:text-lg">{titulo}</h2>

              <p
                className="mt-1 text-xs sm:text-sm"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                {descripcion}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Campaña
              </p>

              <p className="mt-1 truncate text-sm font-semibold">
                {campaña || "Sin seleccionar"}
              </p>
            </div>

            <div className="min-w-0">
              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Gestor
              </p>

              <p className="mt-1 truncate text-sm font-semibold">
                {gestor || "Todos los gestores"}
              </p>
            </div>

            <div className="min-w-0">
              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Número de salida
              </p>

              <p className="mt-1 truncate text-sm font-semibold">
                {numeroSalida ? `+51 ${numeroSalida}` : "Sin seleccionar"}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">
                {enviando ? "Progreso del envío" : "Progreso"}
              </span>

              <span
                className="text-sm font-semibold"
                style={{
                  color: "var(--color-accion)",
                }}
              >
                {progreso}%
              </span>
            </div>

            <div
              className="h-2.5 overflow-hidden rounded-full"
              style={{
                background: "var(--color-fondo-sutil)",
              }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-150"
                style={{
                  width: `${progreso}%`,
                  background: "var(--color-accion)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              className="rounded-lg p-3"
              style={{
                background: "var(--color-fondo-sutil)",
              }}
            >
              <Clock3
                size={16}
                style={{
                  color: "var(--color-texto-suave)",
                }}
              />

              <p className="mt-2 text-lg font-semibold dato-numerico">
                {pendientes}
              </p>

              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Pendientes
              </p>
            </div>

            <div
              className="rounded-lg p-3"
              style={{
                background: "var(--color-fondo-sutil)",
              }}
            >
              <Send
                size={16}
                style={{
                  color: "var(--color-accion)",
                }}
              />

              <p className="mt-2 text-lg font-semibold dato-numerico">
                {preparados}
              </p>

              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Preparados
              </p>
            </div>

            <div
              className="rounded-lg p-3"
              style={{
                background: "var(--color-fondo-sutil)",
              }}
            >
              <CheckCircle2
                size={16}
                style={{
                  color: "var(--color-exito)",
                }}
              />

              <p className="mt-2 text-lg font-semibold dato-numerico">
                {procesados}
              </p>

              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Procesados
              </p>
            </div>

            <div
              className="rounded-lg p-3"
              style={{
                background: "var(--color-fondo-sutil)",
              }}
            >
              <XCircle
                size={16}
                style={{
                  color: "var(--color-error)",
                }}
              />

              <p className="mt-2 text-lg font-semibold dato-numerico">
                {problemas}
              </p>

              <p
                className="text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Con problemas
              </p>
            </div>
          </div>

          {preparando && (
            <div
              className="flex items-center gap-2 rounded-lg p-3 text-xs"
              style={{
                background: "var(--color-accion-suave)",
                color: "var(--color-accion)",
              }}
            >
              <Loader2 size={15} className="shrink-0 animate-spin" />

              <span>Validando teléfonos y preparando destinatarios...</span>
            </div>
          )}

          {enviando && (
            <div
              className="flex items-center gap-2 rounded-lg p-3 text-xs"
              style={{
                background: "var(--color-accion-suave)",
                color: "var(--color-accion)",
              }}
            >
              <Loader2 size={15} className="shrink-0 animate-spin" />

              <span>
                WhatsApp está enviando la campaña. Puedes observar el navegador
                mientras se procesa.
              </span>
            </div>
          )}

          {!enProceso && sinTelefono > 0 && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{
                background: "var(--color-alerta-suave)",
                color: "var(--color-alerta)",
              }}
            >
              {sinTelefono} cliente
              {sinTelefono === 1 ? "" : "s"} no tiene un teléfono celular válido
              para preparar el envío.
            </div>
          )}

          {!enProceso && fallidos > 0 && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{
                background: "var(--color-error-suave)",
                color: "var(--color-error)",
              }}
            >
              {fallidos} registro
              {fallidos === 1 ? "" : "s"} presentó un error durante la
              preparación o el envío.
            </div>
          )}

          {!enProceso &&
            !enviando &&
            progreso === 100 &&
            sinTelefono === 0 &&
            fallidos === 0 && (
              <div
                className="flex items-center gap-2 rounded-lg p-3 text-xs"
                style={{
                  background: "var(--color-exito-suave)",
                  color: "var(--color-exito)",
                }}
              >
                <CheckCircle2 size={15} className="shrink-0" />

                <span>
                  Todos los destinatarios están preparados correctamente.
                </span>
              </div>
            )}
        </div>

        <div
          className="flex justify-end border-t p-4 sm:p-5"
          style={{
            borderColor: "var(--color-borde)",
          }}
        >
          <button
            type="button"
            className="boton-secundario"
            onClick={onCerrar}
            disabled={enProceso}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
