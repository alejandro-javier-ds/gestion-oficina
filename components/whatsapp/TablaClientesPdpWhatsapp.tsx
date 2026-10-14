"use client";
import { Eye } from "lucide-react";
import type { SeguimientoCliente } from "@/lib/whatsapp/seguimiento";
import SeleccionTelefonosWhatsapp from "./SeleccionTelefonosWhatsapp";
import SeguimientoClienteWhatsapp from "./SeguimientoClienteWhatsapp";
import { formatearFechaCalendarioLima } from "@/lib/fecha-lima";
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
  seguimiento?: SeguimientoCliente;
};

type Props = {
  clientes: ClientePdp[];
  seleccionados: string[];
  cargando: boolean;
  error: string;
  telefonosSeleccionados: Record<string, string[]>;
  telefonosManuales: Record<string, string[]>;
  onToggle: (id: string) => void;
  onTelefono: (id: string, numero: string) => void;
  onSeleccionarTelefonos: (id: string, numeros: string[]) => void;
  onAgregarManual: (id: string, numero: string) => void;
  onVistaPrevia: (cliente: ClientePdp) => void;
  soloSinExito?: boolean;
  disabled?: boolean;
};
export default function TablaClientesPdpWhatsapp({
  clientes,
  seleccionados,
  cargando,
  error,
  telefonosSeleccionados,
  telefonosManuales,
  onToggle,
  onTelefono,
  onSeleccionarTelefonos,
  onAgregarManual,
  onVistaPrevia,
  soloSinExito,
  disabled,
}: Props) {
  if (cargando) return <div className="p-6">Cargando clientes PDP...</div>;
  if (error)
    return (
      <p role="alert" className="p-6">
        {error}
      </p>
    );
  if (!clientes.length)
    return <p className="p-6">No hay clientes para estos filtros.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="w-10 p-3" />
            <th className="p-3">Cliente</th>
            <th className="p-3">Status PDP</th>
            <th className="p-3">Monto</th>
            <th className="p-3">Fecha PDP</th>
            <th className="p-3">Teléfonos destino</th>
            <th className="p-3">Mensaje</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr
              key={c.id}
              className="border-b"
              style={{
                background: seleccionados.includes(c.id)
                  ? "var(--color-accion-suave)"
                  : "transparent",
              }}
            >
              <td className="p-3 align-top">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => onToggle(c.id)}
                  disabled={disabled}
                  aria-label={"Seleccionar " + c.cliente}
                />
              </td>
              <td className="p-3 align-top">
                <p className="font-semibold">{c.cliente}</p>
                <p className="mt-1 text-xs">
                  {c.idc} · {c.gestor ?? "Sin gestor"}
                </p>
                <SeguimientoClienteWhatsapp
                  idc={c.idc}
                  seguimiento={c.seguimiento}
                />
              </td>
              <td className="p-3 align-top">
                <span className="chip chip-accion">
                  {c.statusPdp ?? "Sin status PDP"}
                </span>
              </td>
              <td className="p-3 align-top dato-numerico">
                {c.montoPdp == null
                  ? "—"
                  : (c.moneda?.trim().toUpperCase() === "USD" ? "$" : "S/") +
                    " " +
                    c.montoPdp.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </td>
              <td className="p-3 align-top">{formatearFechaCalendarioLima(c.fechaPdp)}</td>
              <td className="p-3 align-top">
                <SeleccionTelefonosWhatsapp
                  cliente={c}
                  seleccionados={telefonosSeleccionados[c.id] ?? []}
                  manuales={telefonosManuales[c.id] ?? []}
                  onToggle={(n) => onTelefono(c.id, n)}
                  onSeleccionar={(ns) => onSeleccionarTelefonos(c.id, ns)}
                  onAgregarManual={(n) => onAgregarManual(c.id, n)}
                  soloSinExito={soloSinExito}
                  disabled={disabled}
                />
              </td>
              <td className="p-3 align-top">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm"
                  style={{ color: "var(--color-accion)" }}
                  onClick={() => onVistaPrevia(c)}
                >
                  <Eye size={15} />
                  Ver mensaje
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
