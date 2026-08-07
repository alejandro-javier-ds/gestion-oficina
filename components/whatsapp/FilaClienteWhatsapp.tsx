// components/whatsapp/FilaClienteWhatsapp.tsx
// Fila individual del módulo WhatsApp Masivo.
// Solo muestra celulares como destinos de WhatsApp.

"use client";

import { Eye, Phone } from "lucide-react";

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
};

type Props = {
  cliente: ClienteWhatsapp;
  seleccionado: boolean;
  telefonoSeleccionado?: string;
  telefonoManual?: string;
  usaTelefonoManual: boolean;
  onToggle: () => void;
  onTelefono: (telefonoId: string) => void;
  onTelefonoManual: (valor: string) => void;
  onUsarManual: () => void;
  onVolverRegistrado: () => void;
  onVistaPrevia: () => void;
};

function fecha(valor: string) {
  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return valor;
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function FilaClienteWhatsapp({
  cliente,
  seleccionado,
  telefonoSeleccionado,
  telefonoManual = "",
  usaTelefonoManual,
  onToggle,
  onTelefono,
  onTelefonoManual,
  onUsarManual,
  onVolverRegistrado,
  onVistaPrevia,
}: Props) {
  const celulares = cliente.telefonos.filter(
    (telefono) =>
      telefono.activo === 1 &&
      telefono.tipo_telefono.toLowerCase() === "celular",
  );

  return (
    <tr className={seleccionado ? "seleccionada" : ""}>
      <td className="whatsapp-col-check">
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={onToggle}
          aria-label={`Seleccionar ${cliente.cliente}`}
        />
      </td>

      <td className="whatsapp-col-cliente">
        <p className="truncate font-semibold" title={cliente.cliente}>
          {cliente.cliente}
        </p>

        <p
          className="mt-1 truncate text-xs"
          style={{ color: "var(--color-texto-suave)" }}
        >
          {cliente.idc}
          {cliente.gestor ? ` · ${cliente.gestor}` : ""}
        </p>
      </td>

      <td className="whatsapp-col-segmentacion">
        <span className="chip chip-accion whitespace-nowrap">
          {cliente.segmentacion ?? "Sin segmentación"}
        </span>
      </td>

      <td className="whatsapp-col-fecha">
        <p className="dato-numerico text-sm font-medium">
          {fecha(cliente.ultimaGestion)}
        </p>

        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Última gestión
        </p>
      </td>

      <td className="whatsapp-col-historico">
        <div className="flex items-start gap-2">
          <Phone
            size={15}
            className="mt-0.5"
            style={{ color: "var(--color-texto-suave)" }}
          />

          <div>
            <p className="dato-numerico text-sm font-medium">
              {cliente.telefonoUltimaGestion || "Sin teléfono"}
            </p>

            <p
              className="mt-1 text-xs"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Usado en gestión
            </p>
          </div>
        </div>
      </td>

      <td className="whatsapp-col-destino">
        {usaTelefonoManual ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <span
                className="flex h-9 items-center rounded-md px-2.5 text-sm"
                style={{
                  background: "var(--color-fondo-sutil)",
                  border: "1px solid var(--color-borde)",
                  color: "var(--color-texto-suave)",
                }}
              >
                +51
              </span>

              <input
                type="text"
                inputMode="numeric"
                value={telefonoManual}
                onChange={(e) =>
                  onTelefonoManual(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Número"
                className="input-estandar min-w-0 w-full"
              />
            </div>

            <button
              type="button"
              className="w-fit text-xs font-medium"
              style={{ color: "var(--color-accion)" }}
              onClick={onVolverRegistrado}
            >
              Usar registrado
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <select
              value={telefonoSeleccionado ?? ""}
              onChange={(e) => onTelefono(e.target.value)}
              className="whatsapp-select whatsapp-select-compact"
            >
              {celulares.length ? (
                celulares.map((telefono) => (
                  <option
                    key={telefono.id_phone}
                    value={String(telefono.id_phone)}
                  >
                    {telefono.phone}
                    {telefono.agregado_manualmente ? " · Manual" : ""}
                  </option>
                ))
              ) : (
                <option value="">Sin celular registrado</option>
              )}
            </select>

            <button
              type="button"
              className="w-fit text-xs font-medium"
              style={{ color: "var(--color-accion)" }}
              onClick={onUsarManual}
            >
              Ingresar otro número
            </button>
          </div>
        )}
      </td>

      <td className="whatsapp-col-mensaje">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium"
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
