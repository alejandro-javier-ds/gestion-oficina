// components/whatsapp/RevisionEnvioWhatsapp.tsx
//
// Ejecuta onConfirmar(), que pertenece al page.tsx.
//
// El page.tsx llama:
//
// POST /api/whatsapp/enviar

"use client";

import { CheckCircle2, Loader2, MessageSquareText, Users } from "lucide-react";

import type { ClienteWhatsapp } from "./FilaClienteWhatsapp";

import VistaPreviaWhatsapp from "./VistaPreviaWhatsapp";

type Props = {
  abierto: boolean;

  clientes: ClienteWhatsapp[];

  mensajes: Record<string, string>;

  mensajeBase: string;

  mensajeBaseOriginal: string;

  numeroSalida: string;

  seleccionados: string[];

  preparados: number;

  sinTelefono: number;

  fallidos: number;

  clienteActivo: ClienteWhatsapp | null;

  numeroDestinoActivo: string;

  campanaId: number | null;

  enviando?: boolean;

  onMensajeBaseChange: (mensaje: string) => void;

  onAplicarATodos: () => void;

  onSeleccionarCliente: (cliente: ClienteWhatsapp) => void;

  onMensajeIndividualChange: (id: string, mensaje: string) => void;

  onRestaurarIndividual: (id: string) => void;

  onCerrarPreview: () => void;

  onConfirmar: () => void | Promise<void>;

  onCerrar: () => void;
};

export default function RevisionEnvioWhatsapp({
  abierto,
  clientes,
  mensajes,
  mensajeBase,
  numeroSalida,
  seleccionados,
  preparados,
  sinTelefono,
  fallidos,
  clienteActivo,
  numeroDestinoActivo,
  campanaId,
  enviando = false,
  onMensajeBaseChange,
  onAplicarATodos,
  onSeleccionarCliente,
  onMensajeIndividualChange,
  onRestaurarIndividual,
  onCerrarPreview,
  onConfirmar,
  onCerrar,
}: Props) {
  if (!abierto) {
    return null;
  }

  const problemas = sinTelefono + fallidos;

  const puedeConfirmar =
    !enviando &&
    campanaId !== null &&
    seleccionados.length > 0 &&
    preparados > 0 &&
    clientes.length > 0;

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/45 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <section
          className="overflow-hidden rounded-xl"
          style={{
            background: "var(--color-superficie)",

            boxShadow: "var(--sombra-lg)",
          }}
        >
          <div
            className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: "var(--color-borde)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="whatsapp-icono">
                <MessageSquareText size={18} />
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Revisión de la campaña
                </h2>

                <p
                  className="mt-1 text-xs sm:text-sm"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  Revisa y personaliza los mensajes antes de confirmar la
                  campaña.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="boton-secundario"
              disabled={enviando}
              onClick={onCerrar}
            >
              Volver
            </button>
          </div>

          <div className="grid gap-4 border-b p-4 sm:grid-cols-4 sm:p-5">
            <div>
              <p className="whatsapp-label">Destinatarios</p>

              <p className="mt-1 text-base font-semibold">
                {seleccionados.length}
              </p>
            </div>

            <div>
              <p className="whatsapp-label">Preparados</p>

              <p
                className="mt-1 text-base font-semibold"
                style={{
                  color: "var(--color-exito)",
                }}
              >
                {preparados}
              </p>
            </div>

            <div>
              <p className="whatsapp-label">Con problemas</p>

              <p
                className="mt-1 text-base font-semibold"
                style={{
                  color:
                    problemas > 0
                      ? "var(--color-alerta)"
                      : "var(--color-texto)",
                }}
              >
                {problemas}
              </p>
            </div>

            <div>
              <p className="whatsapp-label">Número de salida</p>

              <p className="mt-1 truncate text-sm font-semibold">
                {numeroSalida || "Sin seleccionar"}
              </p>
            </div>
          </div>

          <div className="grid min-h-[620px] lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
            <div
              className="border-b p-4 lg:border-b-0 lg:border-r sm:p-5"
              style={{
                borderColor: "var(--color-borde)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Mensaje base</h3>

                  <p
                    className="mt-1 text-xs"
                    style={{
                      color: "var(--color-texto-suave)",
                    }}
                  >
                    Este mensaje se usa como base para todos los destinatarios.
                  </p>
                </div>

                <span className="chip chip-neutral">
                  {mensajeBase.length} caracteres
                </span>
              </div>

              <textarea
                value={mensajeBase}
                onChange={(event) => onMensajeBaseChange(event.target.value)}
                rows={10}
                className="input-estandar mt-3 w-full resize-y"
                disabled={enviando}
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="boton-primario"
                  disabled={
                    enviando || !mensajeBase.trim() || clientes.length === 0
                  }
                  onClick={onAplicarATodos}
                >
                  Aplicar mensaje a todos
                </button>
              </div>

              <div
                className="mt-5 border-t pt-5"
                style={{
                  borderColor: "var(--color-borde)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Users
                    size={16}
                    style={{
                      color: "var(--color-accion)",
                    }}
                  />

                  <h3 className="text-sm font-semibold">Destinatarios</h3>
                </div>

                <div className="mt-3 max-h-[390px] overflow-y-auto rounded-lg">
                  <div className="space-y-1">
                    {clientes.map((cliente) => {
                      const seleccionado = seleccionados.includes(cliente.id);

                      const mensaje = mensajes[cliente.id] ?? "";

                      const activo = clienteActivo?.id === cliente.id;

                      return (
                        <button
                          key={cliente.id}
                          type="button"
                          disabled={enviando}
                          onClick={() => onSeleccionarCliente(cliente)}
                          className="w-full rounded-lg p-3 text-left"
                          style={{
                            background: activo
                              ? "var(--color-accion-suave)"
                              : "var(--color-fondo-sutil)",

                            border: activo
                              ? "1px solid var(--color-accion)"
                              : "1px solid transparent",

                            opacity: seleccionado ? 1 : 0.55,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <CheckCircle2
                              size={16}
                              className="mt-0.5 shrink-0"
                              style={{
                                color: seleccionado
                                  ? "var(--color-exito)"
                                  : "var(--color-texto-tenue)",
                              }}
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {cliente.cliente}
                              </p>

                              <p
                                className="mt-1 truncate text-xs"
                                style={{
                                  color: "var(--color-texto-suave)",
                                }}
                              >
                                {cliente.idc}
                                {" · "}
                                {cliente.gestor ?? "Sin gestor"}
                              </p>

                              <p
                                className="mt-1 truncate text-xs"
                                style={{
                                  color: "var(--color-texto-suave)",
                                }}
                              >
                                {mensaje
                                  ? `${mensaje.length} caracteres`
                                  : "Sin mensaje"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <VistaPreviaWhatsapp
                cliente={clienteActivo}
                numeroSalida={numeroSalida}
                numeroDestino={numeroDestinoActivo}
                mensaje={
                  clienteActivo ? (mensajes[clienteActivo.id] ?? "") : ""
                }
                editable={Boolean(clienteActivo) && !enviando}
                onMensajeChange={(nuevoMensaje: string) => {
                  if (clienteActivo && !enviando) {
                    onMensajeIndividualChange(clienteActivo.id, nuevoMensaje);
                  }
                }}
                onRestaurar={() => {
                  if (clienteActivo && !enviando) {
                    onRestaurarIndividual(clienteActivo.id);
                  }
                }}
                onCerrar={onCerrarPreview}
              />
            </div>
          </div>

          <div
            className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            style={{
              borderColor: "var(--color-borde)",
            }}
          >
            <div>
              <p className="text-sm font-semibold">
                {preparados} destinatarios preparados
              </p>

              <p
                className="mt-1 text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                {campanaId
                  ? `Campaña #${campanaId} lista para confirmar.`
                  : "La campaña todavía no tiene un identificador guardado."}
              </p>
            </div>

            <button
              type="button"
              className="boton-primario"
              disabled={!puedeConfirmar}
              onClick={onConfirmar}
            >
              {enviando ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" />
                  Enviando campaña...
                </span>
              ) : (
                "Confirmar campaña"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
