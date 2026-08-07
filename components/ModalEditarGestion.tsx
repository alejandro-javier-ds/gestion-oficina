// components/ModalEditarGestion.tsx
// Ventana real para editar o eliminar una gestión. Agregado:
// Segmentación editable

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import {
  RAZONES_TAT,
  OTRAS_GESTIONES,
  SEGMENTACIONES,
  OpcionCatalogo,
} from "@/lib/catalogo-tipificacion";

const AZUL_BOTON = "#2874CF";

const RAZONES_DISPONIBLES: OpcionCatalogo[] = [
  ...RAZONES_TAT,
  ...OTRAS_GESTIONES,
];

export type GestionParaEditar = {
  id: number;
  cliente: string | null;
  usuario_gestor_oficina: string;
  categoria: string | null;
  codigo_razon: string | null;
  segmentacion?: string | null;
  fecha_hora: string;
  monto_pagado: number | null;
  observacion: string | null;
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ModalEditarGestion({
  gestion,
  modoInicial = "editar",
  onCerrar,
  onGuardado,
}: {
  gestion: GestionParaEditar | null;
  modoInicial?: "editar" | "eliminar";
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [razon, setRazon] = useState("");
  const [segmentacion, setSegmentacion] = useState("");
  const [monto, setMonto] = useState("");
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (gestion) {
      setRazon(gestion.codigo_razon ?? "");
      setSegmentacion(gestion.segmentacion ?? "");
      setMonto(
        gestion.monto_pagado != null ? String(gestion.monto_pagado) : "",
      );
      setObservacion(gestion.observacion ?? "");
      setConfirmandoBorrado(modoInicial === "eliminar");
      setMensaje(null);
    }
  }, [gestion, modoInicial]);

  if (!gestion) return null;

  async function guardar() {
    setGuardando(true);
    setMensaje(null);

    const montoNumero = monto.trim() === "" ? null : Number(monto);
    if (montoNumero != null && (isNaN(montoNumero) || montoNumero < 0)) {
      setMensaje("El monto pagado debe ser un número válido.");
      setGuardando(false);
      return;
    }

    try {
      const res = await fetch(`/api/gestiones/${gestion!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_razon: razon,
          segmentacion,
          monto_pagado: montoNumero,
          observacion,
        }),
      });

      setGuardando(false);

      if (res.ok) {
        onGuardado();
      } else {
        const data = await res.json().catch(() => null);
        setMensaje(data?.error ?? "Ocurrió un error al guardar.");
      }
    } catch (error) {
      console.error("[ModalEditarGestion] Error de red al guardar:", error);
      setGuardando(false);
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  async function eliminar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/gestiones/${gestion!.id}`, {
        method: "DELETE",
      });
      setGuardando(false);

      if (res.ok) {
        onGuardado();
      } else {
        const data = await res.json().catch(() => null);
        setMensaje(data?.error ?? "Ocurrió un error al eliminar.");
      }
    } catch (error) {
      console.error("[ModalEditarGestion] Error de red al eliminar:", error);
      setGuardando(false);
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 flex items-start justify-center z-[1000]"
        style={{
          background: "rgba(0,0,0,0.5)",
          overflowY: "auto",
          padding: "24px 16px",
        }}
        onClick={onCerrar}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full rounded-lg shadow-xl overflow-hidden"
          style={{
            maxWidth: 480,
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 48px)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{
              borderBottom: "1px solid var(--color-borde)",
              flexShrink: 0,
            }}
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">
                {gestion.cliente ?? "Gestión"}
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--color-texto-suave)" }}
              >
                {gestion.usuario_gestor_oficina} ·{" "}
                {formatearFecha(gestion.fecha_hora)}
              </p>
            </div>
            <button
              onClick={onCerrar}
              className="p-1.5 rounded hover:bg-gray-100 shrink-0"
              style={{ color: "var(--color-texto-suave)" }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="p-5 space-y-4"
            style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}
          >
            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Razón
              </label>
              <select
                value={razon}
                onChange={(e) => setRazon(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: "var(--color-borde-fuerte)" }}
              >
                {!RAZONES_DISPONIBLES.some(
                  (op) => `${op.codigo} - ${op.descripcion}` === razon,
                ) &&
                  razon && <option value={razon}>{razon}</option>}
                {RAZONES_DISPONIBLES.map((op) => (
                  <option
                    key={op.codigo}
                    value={`${op.codigo} - ${op.descripcion}`}
                  >
                    {op.codigo} - {op.descripcion}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Segmentación
              </label>
              <select
                value={segmentacion}
                onChange={(e) => setSegmentacion(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: "var(--color-borde-fuerte)" }}
              >
                <option value="">-- Sin cambios --</option>
                {SEGMENTACIONES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Monto Pagado (S/) — opcional
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm dato-numerico"
                style={{ borderColor: "var(--color-borde-fuerte)" }}
              />
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Observación
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: "var(--color-borde-fuerte)" }}
              />
            </div>

            {mensaje && (
              <p className="text-sm" style={{ color: "#b91c1c" }}>
                {mensaje}
              </p>
            )}

            <AnimatePresence>
              {confirmandoBorrado && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="flex items-center gap-2 text-sm p-3 rounded"
                    style={{ background: "#fef2f2", color: "#b91c1c" }}
                  >
                    <span>¿Eliminar esta gestión? No se puede deshacer.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderTop: "1px solid var(--color-borde)", flexShrink: 0 }}
          >
            {!confirmandoBorrado ? (
              <button
                onClick={() => setConfirmandoBorrado(true)}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: "#b91c1c" }}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            ) : (
              <button
                onClick={eliminar}
                disabled={guardando}
                className="text-sm font-medium disabled:opacity-50"
                style={{ color: "#b91c1c" }}
              >
                {guardando ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={onCerrar}
                className="px-4 py-2 rounded text-sm font-medium"
                style={{
                  color: "var(--color-texto-suave)",
                  border: "1px solid var(--color-borde-fuerte)",
                }}
              >
                Cancelar
              </button>
              {!confirmandoBorrado && (
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: AZUL_BOTON }}
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
