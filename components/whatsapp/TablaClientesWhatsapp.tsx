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
  onToggle: (id: string, cliente?: ClienteWhatsapp) => void;
  onTelefono: (id: string, numero: string, cliente?: ClienteWhatsapp) => void;
  onSeleccionarTelefonos: (
    id: string,
    numeros: string[],
    cliente?: ClienteWhatsapp,
  ) => void;
  onAgregarManual: (
    id: string,
    numero: string,
    cliente?: ClienteWhatsapp,
  ) => void;
  soloSinExito?: boolean;
  disabled?: boolean;
  onVistaPrevia: (cliente: ClienteWhatsapp) => void;
  telefonosSeleccionados: Record<string, string[]>;
  telefonosManuales: Record<string, string[]>;
  vacio?: string;
};

export default function TablaClientesWhatsapp({
  clientes,
  seleccionados,
  cargando,
  error = "",
  onToggle,
  onTelefono,
  onSeleccionarTelefonos,
  onAgregarManual,
  soloSinExito,
  disabled,
  onVistaPrevia,
  telefonosSeleccionados,
  telefonosManuales,
  vacio = "No hay clientes para esta campaña.",
}: Props) {
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
            <th>Teléfonos de destino</th>
            <th className="text-right">Mensaje</th>
          </tr>
        </thead>

        <tbody>
          {clientes.map((cliente) => (
            <FilaClienteWhatsapp
              key={cliente.id}
              cliente={cliente}
              seleccionado={seleccionados.includes(cliente.id)}
              telefonosSeleccionados={telefonosSeleccionados[cliente.id] ?? []}
              telefonosManuales={telefonosManuales[cliente.id] ?? []}
              onToggle={() => onToggle(cliente.id, cliente)}
              onTelefono={(numero) => onTelefono(cliente.id, numero, cliente)}
              onSeleccionarTelefonos={(numeros) =>
                onSeleccionarTelefonos(cliente.id, numeros, cliente)
              }
              onAgregarManual={(numero) =>
                onAgregarManual(cliente.id, numero, cliente)
              }
              soloSinExito={soloSinExito}
              disabled={disabled}
              onVistaPrevia={() => onVistaPrevia(cliente)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
