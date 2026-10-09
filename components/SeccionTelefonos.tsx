// components/SeccionTelefonos.tsx
// Pestaña Teléfonos.
// No modifica la lógica de API ni la estructura de datos.

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Settings, Plus } from "lucide-react";

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
  qtty_phone_ranking: number | null;
  creado_por: string | null;
  editado_por: string | null;
  fecha_modificacion: string | null;
  agregado_manualmente: number;
};

const AZUL_LINK = "#0176D3";

const ETIQUETA_TIPO: Record<string, string> = {
  celular: "Celular del titular",
  fijo: "Teléfono fijo",
  revisar: "Por revisar",
};

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
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SeccionTelefonos({
  idc,
  telefonos,
  onActualizado,
}: {
  idc: string;
  telefonos: Telefono[];
  onActualizado: () => void;
}) {
  const [actualizando, setActualizando] = useState(false);

  const [mostrarFormAgregar, setMostrarFormAgregar] = useState(false);

  const [numeroNuevo, setNumeroNuevo] = useState("");

  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState<string | null>(null);

  const [filaEditando, setFilaEditando] = useState<number | null>(null);

  async function actualizar() {
    setActualizando(true);

    try {
      await onActualizado();
    } finally {
      setActualizando(false);
    }
  }

  async function agregarTelefono() {
    if (!numeroNuevo.trim()) {
      setMensaje("Escribe un número de teléfono.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const res = await fetch("/api/telefonos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idc,
        phone: numeroNuevo.trim(),
      }),
    });

    setGuardando(false);

    if (res.ok) {
      setNumeroNuevo("");
      setMostrarFormAgregar(false);
      onActualizado();
      return;
    }

    const data = await res.json().catch(() => null);

    setMensaje(data?.error ?? "Ocurrió un error al agregar el teléfono.");
  }

  async function cambiarTipo(id: number, tipo: string) {
    const res = await fetch(`/api/telefonos/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo_telefono: tipo,
      }),
    });

    if (res.ok) {
      setFilaEditando(null);
      onActualizado();
    }
  }

  const ultimaActualizacion = telefonos
    .map((t) => t.fecha_modificacion)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col items-start sm:items-center gap-2 mb-5">
        <button
          type="button"
          onClick={actualizar}
          disabled={actualizando}
          className="boton-primario w-full sm:w-auto min-h-10 px-4 sm:px-5"
          style={{
            background: AZUL_LINK,
            borderColor: AZUL_LINK,
          }}
        >
          <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
          Cargar números telefónicos
        </button>

        {ultimaActualizacion && (
          <p className="text-xs text-gray-500 text-left sm:text-center">
            Última actualización: {formatearFecha(ultimaActualizacion)}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center shrink-0"
            style={{
              background: AZUL_LINK,
            }}
          >
            <RefreshCw size={13} className="text-white" />
          </div>

          <h3 className="text-[14px] font-bold text-gray-900">
            Teléfonos ({telefonos.length}
            {telefonos.length >= 10 ? "+" : ""})
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setMostrarFormAgregar((v) => !v)}
          className="boton-secundario w-full sm:w-auto min-h-10 px-3"
          style={{
            color: AZUL_LINK,
          }}
        >
          <Plus size={14} />

          {mostrarFormAgregar ? "Cancelar" : "Agregar teléfono"}
        </button>
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
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="label-estandar">Número de teléfono</label>

                  <input
                    type="text"
                    value={numeroNuevo}
                    onChange={(e) => setNumeroNuevo(e.target.value)}
                    placeholder="Ej. 987654321"
                    className="input-estandar dato-numerico"
                  />
                </div>

                <button
                  type="button"
                  onClick={agregarTelefono}
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
        {telefonos.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Este cliente no tiene teléfonos registrados.
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
                  Número
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Tipo
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                  Prioridad
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Creador Original
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Editor Original
                </th>

                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Fecha Modificación
                </th>

                <th className="w-12" aria-label="Acciones" />
              </tr>
            </thead>

            <tbody className="text-[12px] text-gray-800">
              {telefonos.map((t, i) => (
                <tr
                  key={t.id_phone}
                  style={{
                    background: i % 2 === 1 ? "#FAFAFA" : "white",
                    borderTop: "1px solid #F3F4F6",
                  }}
                >
                  <td
                    className="py-2.5 px-3 dato-numerico whitespace-nowrap"
                    style={{
                      color: AZUL_LINK,
                    }}
                  >
                    {t.phone}
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {filaEditando === t.id_phone ? (
                      <select
                        defaultValue={t.tipo_telefono}
                        onChange={(e) =>
                          cambiarTipo(t.id_phone, e.target.value)
                        }
                        className="select-estandar w-auto min-w-[180px]"
                        autoFocus
                      >
                        <option value="celular">Celular del titular</option>

                        <option value="fijo">Teléfono fijo</option>

                        <option value="revisar">Por revisar</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>
                          {ETIQUETA_TIPO[t.tipo_telefono] ?? t.tipo_telefono}
                        </span>

                        {t.agregado_manualmente === 1 && (
                          <span className="chip chip-accion">Manual</span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-right dato-numerico whitespace-nowrap">
                    {t.qtty_phone_ranking ?? "—"}
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {t.creado_por ?? "—"}
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {t.editado_por ?? "—"}
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {formatearFecha(t.fecha_modificacion)}
                  </td>

                  <td className="py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFilaEditando(
                          filaEditando === t.id_phone ? null : t.id_phone,
                        )
                      }
                      className="w-9 h-9 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-none"
                      aria-label={
                        filaEditando === t.id_phone
                          ? "Cancelar edición"
                          : "Editar tipo de teléfono"
                      }
                    >
                      <Settings size={14} />
                    </button>
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
