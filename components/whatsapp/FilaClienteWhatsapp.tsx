"use client";
import { Eye, Phone } from "lucide-react";
import type { SeguimientoCliente } from "@/lib/whatsapp/seguimiento";
import { formatearFechaHoraLima } from "@/lib/fecha-lima";
import SeleccionTelefonosWhatsapp from "./SeleccionTelefonosWhatsapp";
import SeguimientoClienteWhatsapp from "./SeguimientoClienteWhatsapp";
export type TelefonoWhatsapp = {
  id_phone: number;
  idc: string;
  phone: string;
  tipo_telefono: string;
  agregado_manualmente: number;
  activo: number;
  qtty_phone_ranking: number | null;
};

export type ClienteWhatsapp = {
  id: string;
  idc: string;
  cliente: string;
  gestor: string | null;
  segmentacion: string | null;
  campana: "sin_contacto" | "pdp" | "negociacion" | "renuente" | null;
  ultimaGestion: string;
  telefonoUltimaGestion: string | null;
  telefonos: TelefonoWhatsapp[];
  pdp: unknown | null;
  seguimiento?: SeguimientoCliente;
};

type Props = {
  cliente: ClienteWhatsapp;
  seleccionado: boolean;
  telefonosSeleccionados: string[];
  telefonosManuales: string[];
  onToggle: () => void;
  onTelefono: (numero: string) => void;
  onSeleccionarTelefonos: (numeros: string[]) => void;
  onAgregarManual: (numero: string) => void;
  onVistaPrevia: () => void;
  soloSinExito?: boolean;
  disabled?: boolean;
};
export default function FilaClienteWhatsapp({
  cliente,
  seleccionado,
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
  return (
    <tr className={seleccionado ? "seleccionada" : ""}>
      <td className="whatsapp-col-check align-top">
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={onToggle}
          disabled={disabled}
          aria-label={"Seleccionar " + cliente.cliente}
        />
      </td>
      <td className="whatsapp-col-cliente align-top">
        <p className="font-semibold" title={cliente.cliente}>
          {cliente.cliente}
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-texto-suave)" }}
        >
          {cliente.idc}
          {cliente.gestor ? " · " + cliente.gestor : ""}
        </p>
        <SeguimientoClienteWhatsapp
          seguimiento={cliente.seguimiento}
          idc={cliente.idc}
        />
      </td>
      <td className="whatsapp-col-segmentacion align-top">
        <span className="chip chip-accion">
          {cliente.segmentacion ?? "Sin segmentación"}
        </span>
      </td>
      <td className="whatsapp-col-fecha align-top">
        <p className="dato-numerico text-sm">
          {formatearFechaHoraLima(cliente.ultimaGestion, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
        <p className="mt-1 text-xs">Última gestión</p>
      </td>
      <td className="whatsapp-col-historico align-top">
        <div className="flex gap-2">
          <Phone size={15} />
          <span className="text-sm">
            {cliente.telefonoUltimaGestion || "Sin teléfono"}
          </span>
        </div>
        <p className="mt-1 text-xs">Usado en gestión</p>
      </td>
      <td className="whatsapp-col-destino align-top">
        <SeleccionTelefonosWhatsapp
          cliente={cliente}
          seleccionados={telefonosSeleccionados}
          manuales={telefonosManuales}
          onToggle={onTelefono}
          onSeleccionar={onSeleccionarTelefonos}
          onAgregarManual={onAgregarManual}
          soloSinExito={soloSinExito}
          disabled={disabled}
        />
      </td>
      <td className="whatsapp-col-mensaje align-top">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--color-accion)" }}
          onClick={onVistaPrevia}
        >
          <Eye size={15} />
          Ver mensaje
        </button>
      </td>
    </tr>
  );
}
