// components/SeccionDirecciones.tsx
//
// Pestaña Direcciones.

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Settings, RotateCw, Plus } from "lucide-react";

type Direccion = {
  id: number;
  direccion: string;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  tipo: string;
  fuente: string;
  fecha_modificacion: string;
};

const AZUL_LINK = "#0176D3";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";

  const fecha = new Date(iso);

  if (isNaN(fecha.getTime())) {
    return String(iso);
  }

  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SeccionDirecciones({
  idc,
  direcciones,
  onActualizado,
}: {
  idc: string;
  direcciones: Direccion[];
  onActualizado: () => void;
}) {
  const [actualizando, setActualizando] = useState(false);

  const [mostrarFormAgregar, setMostrarFormAgregar] = useState(false);

  const [nuevaDireccion, setNuevaDireccion] = useState("");

  const [nuevoDistrito, setNuevoDistrito] = useState("");

  const [nuevoTipo, setNuevoTipo] = useState("Domicilio");

  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState<string | null>(null);

  const [filaEditando, setFilaEditando] = useState<number | null>(null);

  const [textoEdicion, setTextoEdicion] = useState("");

  async function actualizar() {
    setActualizando(true);

    try {
      await onActualizado();
    } finally {
      setActualizando(false);
    }
  }

  async function agregarDireccion() {
    if (!nuevaDireccion.trim()) {
      setMensaje("Escribe una dirección.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const res = await fetch("/api/direcciones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idc,
        direccion: nuevaDireccion.trim(),
        distrito: nuevoDistrito.trim() || null,
        tipo: nuevoTipo,
      }),
    });

    setGuardando(false);

    if (res.ok) {
      setNuevaDireccion("");
      setNuevoDistrito("");
      setMostrarFormAgregar(false);
      onActualizado();
      return;
    }

    const data = await res.json().catch(() => null);

    setMensaje(data?.error ?? "Ocurrió un error al agregar la dirección.");
  }

  function empezarEdicion(direccion: Direccion) {
    setFilaEditando(direccion.id);
    setTextoEdicion(direccion.direccion);
  }

  async function guardarEdicion(id: number) {
    if (!textoEdicion.trim()) {
      setMensaje("La dirección no puede estar vacía.");
      return;
    }

    const res = await fetch(`/api/direcciones/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direccion: textoEdicion.trim(),
      }),
    });

    if (res.ok) {
      setFilaEditando(null);
      setTextoEdicion("");
      setMensaje(null);
      onActualizado();
      return;
    }

    const data = await res.json().catch(() => null);

    setMensaje(data?.error ?? "Ocurrió un error al actualizar la dirección.");
  }

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{
              background: AZUL_LINK,
            }}
          >
            <MapPin size={15} className="text-white" />
          </div>

          <h3 className="text-[14px] font-bold text-gray-900">
            Direcciones del cliente ({direcciones.length})
          </h3>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarFormAgregar((v) => !v)}
            className="boton-secundario flex-1 sm:flex-none min-h-10 px-3"
            style={{
              color: AZUL_LINK,
            }}
          >
            <Plus size={14} />

            {mostrarFormAgregar ? "Cancelar" : "Agregar dirección"}
          </button>

          <button
            type="button"
            onClick={actualizar}
            disabled={actualizando}
            className="w-10 h-10 shrink-0 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60 focus-visible:outline-none"
            aria-label="Actualizar direcciones"
            title="Actualizar direcciones"
          >
            <RotateCw
              size={15}
              className={actualizando ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mostrarFormAgregar && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            transition={{
              duration: 0.18,
            }}
            className="overflow-hidden mb-3"
          >
            <div className="tarjeta p-3">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px_160px_auto] gap-2 items-end">
                <div className="min-w-0">
                  <label className="label-estandar">Dirección</label>

                  <input
                    type="text"
                    value={nuevaDireccion}
                    onChange={(e) => setNuevaDireccion(e.target.value)}
                    placeholder="Ej. Av. Los Álamos 123, Dpto 4B"
                    className="input-estandar"
                  />
                </div>

                <div>
                  <label className="label-estandar">Distrito</label>

                  <input
                    type="text"
                    value={nuevoDistrito}
                    onChange={(e) => setNuevoDistrito(e.target.value)}
                    placeholder="Ej. Miraflores"
                    className="input-estandar"
                  />
                </div>

                <div>
                  <label className="label-estandar">Tipo</label>

                  <select
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value)}
                    className="select-estandar"
                  >
                    <option value="Domicilio">Domicilio</option>

                    <option value="Comercial">Comercial</option>

                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={agregarDireccion}
                  disabled={guardando}
                  className="boton-primario w-full sm:w-auto min-h-10 px-4"
                  style={{
                    background: AZUL_LINK,
                    borderColor: AZUL_LINK,
                  }}
                >
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>

              {mensaje && (
                <motion.p
                  initial={{
                    opacity: 0,
                    y: -2,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="text-xs mt-2"
                  style={{
                    color: "#B91C1C",
                  }}
                >
                  {mensaje}
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tabla-scroll rounded border border-gray-200">
        {direcciones.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Este cliente no tiene direcciones registradas.
          </p>
        ) : (
          <table
            className="w-full text-left border-collapse"
            style={{
              minWidth: "700px",
            }}
          >
            <thead
              style={{
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <tr>
                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Nombre
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Tipo
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Ubicación
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Fuente
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Actualizado
                </th>

                <th className="w-12" aria-label="Acciones" />
              </tr>
            </thead>

            <tbody className="text-[12px] text-gray-800">
              {direcciones.map((d, i) => (
                <tr
                  key={d.id}
                  style={{
                    background: i % 2 === 1 ? "#FAFAFA" : "white",
                    borderTop: "1px solid #F3F4F6",
                  }}
                >
                  <td
                    className="py-2.5 px-3 align-middle"
                    style={{
                      color: AZUL_LINK,
                      minWidth: "280px",
                    }}
                  >
                    {filaEditando === d.id ? (
                      <input
                        type="text"
                        value={textoEdicion}
                        onChange={(e) => setTextoEdicion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            guardarEdicion(d.id);
                          }

                          if (e.key === "Escape") {
                            setFilaEditando(null);
                            setTextoEdicion("");
                          }
                        }}
                        autoFocus
                        className="input-estandar min-w-[260px]"
                      />
                    ) : (
                      <span
                        className="block max-w-[360px] truncate"
                        title={d.direccion}
                      >
                        {d.direccion}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                    {d.tipo}
                  </td>

                  <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                    {[d.departamento, d.provincia, d.distrito]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>

                  <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                    <span
                      className={`chip ${
                        d.fuente === "manual" ? "chip-accion" : "chip-neutral"
                      }`}
                    >
                      {d.fuente === "manual" ? "Manual" : "Portafolio"}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 align-middle text-gray-500 whitespace-nowrap">
                    {formatearFecha(d.fecha_modificacion)}
                  </td>

                  <td className="py-2.5 px-2 align-middle text-center">
                    {filaEditando === d.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => guardarEdicion(d.id)}
                          className="min-h-9 px-2 text-xs font-medium rounded hover:bg-[var(--color-fondo-sutil)] transition-colors focus-visible:outline-none"
                          style={{
                            color: AZUL_LINK,
                          }}
                        >
                          Guardar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFilaEditando(null);
                            setTextoEdicion("");
                          }}
                          className="w-9 h-9 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-none"
                          aria-label="Cancelar edición"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => empezarEdicion(d)}
                        className="w-9 h-9 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-none"
                        aria-label="Editar dirección"
                        title="Editar dirección"
                      >
                        <Settings size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
