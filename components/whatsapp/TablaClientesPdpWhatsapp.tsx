// components/whatsapp/TablaClientesPdpWhatsapp.tsx
// Tabla PDP con el mismo flujo visual de Gestiones.
// Solo maneja presentación y eventos recibidos.

"use client";

import { Check, ChevronDown, Eye, Phone } from "lucide-react";

export type TelefonoPdp = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
  activo: number;
  qtty_phone_ranking: number | null;
};

export type ClientePdp = {
  id: string;
  idc: string;
  cliente: string;
  gestor: string | null;

  statusPdp: string | null;

  tipo: string;

  moneda: string;

  montoPdp: number | null;

  montoDolares: number | null;

  fechaPdp: string;

  estadoPdp: string;

  fechaRegistro: string;

  telefonos: TelefonoPdp[];

  telefonoPredeterminado: string;
};

type Props = {
  clientes: ClientePdp[];

  seleccionados: string[];

  cargando: boolean;

  error: string;

  telefonosSeleccionados: Record<string, string>;

  telefonosManuales: Record<string, string>;

  usarTelefonoManual: Record<string, boolean>;

  onToggle: (id: string) => void;

  onTelefono: (id: string, telefonoId: string) => void;

  onTelefonoManual: (id: string, valor: string) => void;

  onUsarManual: (id: string) => void;

  onVolverRegistrado: (id: string) => void;

  onVistaPrevia: (cliente: ClientePdp) => void;
};

function formatearMonto(cliente: ClientePdp): string {
  if (cliente.montoPdp === null || cliente.montoPdp === undefined) {
    return "—";
  }

  const moneda = cliente.moneda?.trim().toUpperCase();

  const simbolo = moneda === "USD" ? "$" : "S/";

  return `${simbolo} ${cliente.montoPdp.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizarTelefono(valor: string): string {
  return valor.replace(/\D/g, "").replace(/^51/, "").slice(0, 9);
}

export default function TablaClientesPdpWhatsapp({
  clientes,
  seleccionados,
  cargando,
  error,
  telefonosSeleccionados,
  telefonosManuales,
  usarTelefonoManual,
  onToggle,
  onTelefono,
  onTelefonoManual,
  onUsarManual,
  onVolverRegistrado,
  onVistaPrevia,
}: Props) {
  if (cargando) {
    return (
      <section className="tarjeta overflow-hidden">
        <div className="p-8 text-center text-sm">Cargando clientes PDP...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="tarjeta overflow-hidden">
        <div
          className="p-8 text-center text-sm"
          style={{
            color: "var(--color-alerta)",
          }}
        >
          {error}
        </div>
      </section>
    );
  }

  if (clientes.length === 0) {
    return (
      <section className="tarjeta overflow-hidden">
        <div className="p-8 text-center">
          <p className="text-sm font-medium">
            No hay clientes para esta campaña.
          </p>

          <p
            className="mt-1 text-xs"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            No existen PDPs con este Status PDP.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta overflow-hidden">
      <div
        className="flex items-center justify-between border-b p-4 sm:p-5"
        style={{
          borderColor: "var(--color-borde)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="whatsapp-icono">
            <Phone size={17} />
          </div>

          <div>
            <h3 className="text-base font-semibold">Últimos clientes PDP</h3>

            <p
              className="mt-1 text-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Clientes disponibles para la campaña seleccionada.
            </p>
          </div>
        </div>

        <span className="chip chip-neutral">
          {seleccionados.length} seleccionados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left"
              style={{
                borderColor: "var(--color-borde)",
              }}
            >
              <th className="w-[45px] px-4 py-3" />

              <th className="px-4 py-3">Cliente</th>

              <th className="px-4 py-3">Status PDP</th>

              <th className="px-4 py-3">Monto</th>

              <th className="px-4 py-3">Fecha PDP</th>

              <th className="px-4 py-3">Teléfono destino</th>

              <th className="px-4 py-3">Mensaje</th>
            </tr>
          </thead>

          <tbody>
            {clientes.map((cliente) => {
              const seleccionado = seleccionados.includes(cliente.id);

              const manual = usarTelefonoManual[cliente.id] ?? false;

              const telefonoSeleccionado =
                telefonosSeleccionados[cliente.id] ?? "";

              const telefonoManual = telefonosManuales[cliente.id] ?? "";

              return (
                <tr
                  key={`${cliente.idc}-${cliente.id}`}
                  className="border-b"
                  style={{
                    borderColor: "var(--color-borde)",

                    background: seleccionado
                      ? "var(--color-accion-suave)"
                      : "transparent",
                  }}
                >
                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      aria-label={
                        seleccionado ? "Quitar cliente" : "Seleccionar cliente"
                      }
                      onClick={() => onToggle(cliente.id)}
                      className="flex h-5 w-5 items-center justify-center rounded border"
                      style={{
                        borderColor: seleccionado
                          ? "var(--color-accion)"
                          : "var(--color-borde-fuerte)",

                        background: seleccionado
                          ? "var(--color-accion)"
                          : "var(--color-superficie)",
                      }}
                    >
                      {seleccionado && (
                        <Check size={13} color="white" strokeWidth={3} />
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p className="truncate font-medium">{cliente.cliente}</p>

                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: "var(--color-texto-suave)",
                      }}
                    >
                      {cliente.idc}
                      {" · "}
                      {cliente.gestor ?? "Sin gestor"}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className="chip chip-accion">
                      {cliente.statusPdp ?? "Sin Status PDP"}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top dato-numerico">
                    {formatearMonto(cliente)}
                  </td>

                  <td className="px-4 py-4 align-top dato-numerico">
                    {cliente.fechaPdp || "—"}
                  </td>

                  <td className="min-w-[245px] px-4 py-4 align-top">
                    {!manual ? (
                      <>
                        <div className="flex items-center gap-2">
                          <select
                            value={telefonoSeleccionado}
                            onChange={(event) =>
                              onTelefono(cliente.id, event.target.value)
                            }
                            className="whatsapp-select h-[38px] min-w-0 flex-1"
                          >
                            <option value="">
                              {cliente.telefonoPredeterminado
                                ? cliente.telefonoPredeterminado
                                : "Seleccionar teléfono"}
                            </option>

                            {cliente.telefonos.map((telefono) => (
                              <option
                                key={`${cliente.idc}-${telefono.id_phone}`}
                                value={String(telefono.id_phone)}
                              >
                                {telefono.phone}
                              </option>
                            ))}
                          </select>

                          <ChevronDown
                            size={15}
                            className="pointer-events-none -ml-8 mr-2"
                            style={{
                              color: "var(--color-texto-suave)",
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          className="mt-1 text-[11px] font-medium"
                          style={{
                            color: "var(--color-accion)",
                          }}
                          onClick={() => onUsarManual(cliente.id)}
                        >
                          Ingresar otro número
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            value={telefonoManual}
                            onChange={(event) =>
                              onTelefonoManual(
                                cliente.id,
                                normalizarTelefono(event.target.value),
                              )
                            }
                            inputMode="numeric"
                            maxLength={9}
                            placeholder="9XXXXXXXX"
                            className="input-estandar h-[38px] min-w-0 flex-1"
                          />
                        </div>

                        <button
                          type="button"
                          className="mt-1 text-[11px] font-medium"
                          style={{
                            color: "var(--color-accion)",
                          }}
                          onClick={() => onVolverRegistrado(cliente.id)}
                        >
                          Usar registrado
                        </button>
                      </>
                    )}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-medium"
                      style={{
                        color: "var(--color-accion)",
                      }}
                      onClick={() => onVistaPrevia(cliente)}
                    >
                      <Eye size={15} />
                      Ver mensaje
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center justify-between border-t p-4 sm:p-5"
        style={{
          borderColor: "var(--color-borde)",
        }}
      >
        <span className="text-sm font-medium">
          {seleccionados.length} seleccionados
        </span>

        <span
          className="text-xs"
          style={{
            color: "var(--color-texto-suave)",
          }}
        >
          {clientes.length} clientes disponibles
        </span>
      </div>
    </section>
  );
}
