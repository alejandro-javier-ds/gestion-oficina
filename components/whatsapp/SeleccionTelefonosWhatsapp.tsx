"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  celularesActivosWhatsapp,
  normalizarCelularWhatsapp,
  type TelefonoSeleccionable,
  type SeguimientoCliente,
} from "@/lib/whatsapp/seguimiento";
import { fechaIntentoWhatsapp } from "./SeguimientoClienteWhatsapp";

export function telefonosElegiblesWhatsapp(
  cliente: {
    telefonos: TelefonoSeleccionable[];
    seguimiento?: SeguimientoCliente;
  },
  manuales: string[] = [],
) {
  const opciones = new Set(
    celularesActivosWhatsapp(cliente.telefonos).map((t) => t.phone),
  );
  for (const n of [
    ...manuales,
    ...(cliente.seguimiento?.telefonos
      .filter((t) => t.manual)
      .map((t) => t.numero) ?? []),
  ]) {
    const numero = normalizarCelularWhatsapp(n);
    if (numero) opciones.add(numero);
  }
  const estados = new Map<string, string>(
    cliente.seguimiento?.telefonos.map((t) => [t.numero, t.estado] as const) ??
      [],
  );
  return [...opciones].filter(
    (n) =>
      !["ENVIADO", "EN_PROCESO", "INCIERTO"].includes(
        estados.get(n) ?? "PENDIENTE",
      ),
  );
}

export default function SeleccionTelefonosWhatsapp({
  cliente,
  seleccionados,
  manuales,
  onToggle,
  onSeleccionar,
  onAgregarManual,
  soloSinExito = false,
  disabled = false,
}: {
  cliente: {
    cliente: string;
    telefonos: TelefonoSeleccionable[];
    seguimiento?: SeguimientoCliente;
  };
  seleccionados: string[];
  manuales: string[];
  onToggle: (numero: string) => void;
  onSeleccionar: (numeros: string[]) => void;
  onAgregarManual: (numero: string) => void;
  soloSinExito?: boolean;
  disabled?: boolean;
}) {
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const opciones = new Map(
    celularesActivosWhatsapp(cliente.telefonos).map((t) => [t.phone, false]),
  );
  for (const n of [
    ...manuales,
    ...(cliente.seguimiento?.telefonos
      .filter((t) => t.manual)
      .map((t) => t.numero) ?? []),
  ])
    if (!opciones.has(n)) opciones.set(n, true);
  const estados = new Map(
    cliente.seguimiento?.telefonos.map((t) => [t.numero, t]),
  );
  const elegibles = telefonosElegiblesWhatsapp(cliente, manuales);
  const pendientes = elegibles.filter(
    (n) => (estados.get(n)?.estado ?? "PENDIENTE") === "PENDIENTE",
  );
  const cantidadVisibles = [...opciones].filter(
    ([n]) => !soloSinExito || estados.get(n)?.estado !== "ENVIADO",
  ).length;
  return (
    <div className="min-w-0">
      <details className="group">
        <summary
          className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:shadow-sm"
          style={{
            borderColor: "var(--color-borde)",
            background: "var(--color-superficie)",
          }}
          aria-label={`Teléfonos de ${cliente.cliente}, ${seleccionados.length} seleccionados`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">
              {seleccionados.length ? "Teléfonos" : "Elegir teléfonos"}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: seleccionados.length
                  ? "var(--color-accion)"
                  : "var(--color-texto-suave)",
                background: seleccionados.length
                  ? "var(--color-accion-suave)"
                  : "var(--color-fondo-sutil)",
              }}
            >
              {seleccionados.length} seleccionados
            </span>
          </span>
          <ChevronDown
            size={15}
            className="shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div
          className="mt-1.5 space-y-2 rounded-lg border p-2.5 shadow-sm"
          style={{
            borderColor: "var(--color-borde)",
            background: "var(--color-superficie)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium">
              Números disponibles
              {soloSinExito ? ` · ${cantidadVisibles}` : ""}
            </p>
            <div className="flex gap-1 text-[10px]">
              <button
                type="button"
                disabled={disabled || !elegibles.length}
                className="rounded px-1.5 py-1 font-medium transition hover:bg-[var(--color-accion-suave)] disabled:opacity-50"
                style={{ color: "var(--color-accion)" }}
                onClick={() => onSeleccionar(elegibles)}
              >
                Todos
              </button>
              <button
                type="button"
                disabled={disabled || !pendientes.length}
                className="rounded px-1.5 py-1 font-medium transition hover:bg-[var(--color-accion-suave)] disabled:opacity-50"
                style={{ color: "var(--color-accion)" }}
                onClick={() => onSeleccionar(pendientes)}
              >
                Pendientes
              </button>
              <button
                type="button"
                disabled={disabled}
                className="rounded px-1.5 py-1 transition hover:bg-[var(--color-fondo-sutil)] disabled:opacity-50"
                onClick={() => onSeleccionar([])}
              >
                Limpiar
              </button>
            </div>
          </div>
          <div
            className="max-h-40 overflow-y-auto divide-y rounded-md border px-2"
            style={{ borderColor: "var(--color-borde)" }}
          >
            {[...opciones]
              .filter(
                ([n]) => !soloSinExito || estados.get(n)?.estado !== "ENVIADO",
              )
              .map(([n, esManual]) => {
                const s = estados.get(n);
                const estado = s?.estado ?? "PENDIENTE";
                const bloqueado = ["ENVIADO", "EN_PROCESO", "INCIERTO"].includes(
                  estado,
                );
                const etiquetaEstado =
                  estado === "ENVIADO"
                    ? "Enviado"
                    : estado === "FALLIDO"
                      ? "Fallido"
                      : estado === "EN_PROCESO"
                        ? "En proceso"
                        : estado === "INCIERTO"
                          ? "Verificar"
                          : "Pendiente";
                const detalle = [
                  s?.fechaUltimoIntento
                    ? fechaIntentoWhatsapp(s.fechaUltimoIntento)
                    : "Sin intento",
                  s?.campanaId ? `Campaña #${s.campanaId}` : "Nueva campaña",
                  s?.numeroSalida ? `Remitente ${s.numeroSalida}` : "",
                  bloqueado
                    ? estado === "ENVIADO"
                      ? "El seguimiento requiere una campaña nueva"
                      : "Espera o revisa WhatsApp antes de reenviar"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <label
                    key={n}
                    className="flex cursor-pointer items-center gap-2 rounded py-1.5 text-xs transition hover:bg-[var(--color-fondo-sutil)]"
                    title={detalle}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={!bloqueado && seleccionados.includes(n)}
                      disabled={disabled || bloqueado}
                      onChange={() => onToggle(n)}
                      aria-label={`Seleccionar teléfono ${n} de ${cliente.cliente}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {n}
                      {esManual ? " · Manual" : ""}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s?.enviosAnteriores ? (
                        <span
                          className="rounded-full border px-1.5 py-0.5 text-[9px]"
                          style={{
                            color: "var(--color-alerta)",
                            borderColor: "var(--color-alerta)",
                          }}
                          title={`Envío previo en la campaña #${s.ultimoEnvioAnterior?.campanaId ?? "anterior"}`}
                        >
                          Previo
                        </span>
                      ) : null}
                      {s?.resultadosAnterioresInciertos ? (
                        <span
                          className="rounded-full border px-1.5 py-0.5 text-[9px]"
                          style={{
                            color: "var(--color-error)",
                            borderColor: "var(--color-error)",
                          }}
                          title="Revisa la confirmación de resultado antes de enviar una campaña nueva."
                        >
                          Revisar
                        </span>
                      ) : null}
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          color:
                            estado === "ENVIADO"
                              ? "var(--color-exito)"
                              : estado === "FALLIDO" || estado === "INCIERTO"
                                ? "var(--color-error)"
                                : estado === "EN_PROCESO"
                                  ? "var(--color-alerta)"
                                  : "var(--color-texto-suave)",
                          background: "var(--color-fondo-sutil)",
                        }}
                      >
                        {etiquetaEstado}
                      </span>
                    </span>
                  </label>
                );
              })}
            {!opciones.size && (
              <p className="py-1 text-[11px]">Sin celulares activos y válidos.</p>
            )}
          </div>
          <div
            className="border-t pt-2.5"
            style={{ borderColor: "var(--color-borde)" }}
          >
            <p className="mb-1.5 text-[11px] font-semibold">
              Agregar número manual
            </p>
            <div className="flex gap-1.5">
              <input
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  setError("");
                }}
                disabled={disabled}
                inputMode="tel"
                maxLength={25}
                placeholder="Celular no registrado"
                className="whatsapp-select min-w-0 flex-1 text-xs"
                aria-label={`Celular manual de ${cliente.cliente}`}
              />
              <button
                type="button"
                className="boton-secundario px-2 text-xs"
                disabled={disabled || !manual.trim()}
                onClick={() => {
                  const n = normalizarCelularWhatsapp(manual);
                  if (!n) {
                    setError("Ingresa un celular peruano válido de nueve dígitos.");
                    return;
                  }
                  if (
                    ["ENVIADO", "EN_PROCESO", "INCIERTO"].includes(
                      estados.get(n)?.estado ?? "",
                    )
                  ) {
                    setError(
                      "Ese teléfono ya fue enviado o requiere verificar su resultado.",
                    );
                    return;
                  }
                  onAgregarManual(n);
                  setManual("");
                  setError("");
                }}
              >
                Agregar
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-1.5 text-[11px]"
                style={{ color: "var(--color-error)" }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
