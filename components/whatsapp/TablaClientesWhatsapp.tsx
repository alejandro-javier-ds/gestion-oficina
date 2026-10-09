// components/whatsapp/TablaClientesWhatsapp.tsx

"use client";

import { Loader2, Search } from "lucide-react";
import FilaClienteWhatsapp, {
  type ClienteWhatsapp,
} from "@/components/whatsapp/FilaClienteWhatsapp";

type Props = {
  clientes: ClienteWhatsapp[];
  seleccionados: string[];
  cargando: boolean;
  error?: string;
  onToggle: (id: string) => void;
  onTelefono: (id: string, telefonoId: string) => void;
  onTelefonoManual: (id: string, valor: string) => void;
  onUsarManual: (id: string) => void;
  onVolverRegistrado: (id: string) => void;
  onVistaPrevia: (cliente: ClienteWhatsapp) => void;
  telefonosSeleccionados: Record<string, string>;
  telefonosManuales: Record<string, string>;
  usarTelefonoManual: Record<string, boolean>;
  vacio?: string;
};

export default function TablaClientesWhatsapp({
  clientes,
  seleccionados,
  cargando,
  error = "",
  onToggle,
  onTelefono,
  onTelefonoManual,
  onUsarManual,
  onVolverRegistrado,
  onVistaPrevia,
  telefonosSeleccionados,
  telefonosManuales,
  usarTelefonoManual,
  vacio = "No hay clientes para esta campaña.",
}: Props) {
  function primerCelular(cliente: ClienteWhatsapp) {
    return String(
      cliente.telefonos.find(
        (telefono) =>
          telefono.activo === 1 &&
          telefono.tipo_telefono.toLowerCase() === "celular",
      )?.id_phone ?? "",
    );
  }

  if (cargando) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm">
          <Loader2
            size={18}
            className="animate-spin"
            style={{ color: "var(--color-accion)" }}
          />
          <span style={{ color: "var(--color-texto-suave)" }}>
            Cargando clientes...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[220px] items-center justify-center p-6 text-center">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-error)" }}
          >
            No se pudieron cargar los clientes
          </p>

          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-texto-suave)" }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!clientes.length) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
        <div className="whatsapp-icono">
          <Search size={18} />
        </div>

        <p className="mt-3 text-sm font-medium">{vacio}</p>

        <p
          className="mt-1 max-w-md text-xs"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Prueba con otro rango, búsqueda o campaña.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="whatsapp-tabla">
        <thead>
          <tr>
            <th className="w-10" />
            <th>Cliente</th>
            <th>Segmentación</th>
            <th>Última gestión</th>
            <th>Teléfono usado</th>
            <th>Teléfono de destino</th>
            <th className="text-right">Mensaje</th>
          </tr>
        </thead>

        <tbody>
          {clientes.map((cliente) => (
            <FilaClienteWhatsapp
              key={cliente.id}
              cliente={cliente}
              seleccionado={seleccionados.includes(cliente.id)}
              telefonoSeleccionado={
                telefonosSeleccionados[cliente.id] ?? primerCelular(cliente)
              }
              telefonoManual={telefonosManuales[cliente.id] ?? ""}
              usaTelefonoManual={usarTelefonoManual[cliente.id] ?? false}
              onToggle={() => onToggle(cliente.id)}
              onTelefono={(telefonoId) => onTelefono(cliente.id, telefonoId)}
              onTelefonoManual={(valor) => onTelefonoManual(cliente.id, valor)}
              onUsarManual={() => onUsarManual(cliente.id)}
              onVolverRegistrado={() => onVolverRegistrado(cliente.id)}
              onVistaPrevia={() => onVistaPrevia(cliente)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
