// components/ModalEditarPromesa.tsx
// Ventana para editar o eliminar una Promesa de Pago.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import {
  TIPOS_PROMESA_PAGO,
  MODALIDADES_PAGO,
  TIPOS_NEGOCIACION,
  BENEFICIOS,
  STATUS_PDP,
  STATUS_PAGO,
} from "@/lib/catalogo-tipificacion";

const AZUL_BOTON = "#2874CF";

export type PromesaParaEditar = {
  id: number;
  cliente: string | null;
  gestor: string;
  tipo: string;
  moneda: string;
  monto_prometido: number | null;
  modalidad_pago: string | null;
  observacion: string | null;
  fecha_promesa: string;
  estado: string;
  tipo_negociacion?: string | null;
  beneficio?: string | null;
  status_pdp?: string | null;
  status_pago?: string | null;
  numero_cuotas_aprobadas?: number | null;
};

function extraerCodigo(valorConDescripcion: string | null): string {
  if (!valorConDescripcion) return "";
  return valorConDescripcion.split(" - ")[0];
}

export default function ModalEditarPromesa({
  promesa,
  onCerrar,
  onGuardado,
}: {
  promesa: PromesaParaEditar | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState("");
  const [moneda, setMoneda] = useState("Soles");
  const [monto, setMonto] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState("vigente");
  const [tipoNegociacion, setTipoNegociacion] = useState("");
  const [beneficio, setBeneficio] = useState("");
  const [statusPdp, setStatusPdp] = useState("");
  const [statusPago, setStatusPago] = useState("");
  const [numeroCuotas, setNumeroCuotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (promesa) {
      setTipo(promesa.tipo);
      setMoneda(promesa.moneda);
      setMonto(
        promesa.monto_prometido != null ? String(promesa.monto_prometido) : "",
      );
      setModalidad(extraerCodigo(promesa.modalidad_pago));
      setObservacion(promesa.observacion ?? "");
      setFecha(promesa.fecha_promesa?.slice(0, 10) ?? "");
      setEstado(promesa.estado);
      setTipoNegociacion(promesa.tipo_negociacion ?? "");
      setBeneficio(promesa.beneficio ?? "");
      setStatusPdp(promesa.status_pdp ?? "");
      setStatusPago(promesa.status_pago ?? "");
      setNumeroCuotas(
        promesa.numero_cuotas_aprobadas != null
          ? String(promesa.numero_cuotas_aprobadas)
          : "",
      );
      setConfirmandoBorrado(false);
      setMensaje(null);
    }
  }, [promesa]);

  if (!promesa) return null;

  async function guardar() {
    setGuardando(true);
    setMensaje(null);

    const montoNumero = monto.trim() === "" ? null : Number(monto);
    if (montoNumero != null && (isNaN(montoNumero) || montoNumero < 0)) {
      setMensaje("El monto prometido debe ser un número válido.");
      setGuardando(false);
      return;
    }

    const cuotasNumero =
      numeroCuotas.trim() === "" ? null : Number(numeroCuotas);
    if (cuotasNumero != null && (isNaN(cuotasNumero) || cuotasNumero < 0)) {
      setMensaje("El número de cuotas debe ser un número válido.");
      setGuardando(false);
      return;
    }

    const res = await fetch(`/api/promesas/${promesa!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        moneda,
        monto_prometido: montoNumero,
        modalidad_pago: modalidad,
        observacion,
        fecha_promesa: fecha,
        estado,
        tipo_negociacion: tipoNegociacion,
        beneficio,
        status_pdp: statusPdp,
        status_pago: statusPago,
        numero_cuotas_aprobadas: cuotasNumero,
      }),
    });

    setGuardando(false);

    if (res.ok) {
      onGuardado();
    } else {
      const data = await res.json().catch(() => null);
      setMensaje(data?.error ?? "Ocurrió un error al guardar.");
    }
  }

  async function eliminar() {
    setGuardando(true);
    const res = await fetch(`/api/promesas/${promesa!.id}`, {
      method: "DELETE",
    });
    setGuardando(false);

    if (res.ok) {
      onGuardado();
    } else {
      const data = await res.json().catch(() => null);
      setMensaje(data?.error ?? "Ocurrió un error al eliminar.");
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
            maxWidth: 520,
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
                {promesa.cliente ?? "Promesa de Pago"}
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--color-texto-suave)" }}
              >
                {promesa.gestor}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Tipo de promesa
                </label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                >
                  {TIPOS_PROMESA_PAGO.map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.codigo} - {t.descripcion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Moneda
                </label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                >
                  <option value="Soles">Soles</option>
                  <option value="Dolares">Dólares</option>
                </select>
              </div>
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: "var(--color-borde-fuerte)" }}
              >
                <option value="vigente">Vigente</option>
                <option value="cumplida">Cumplida</option>
                <option value="rota">Rota</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Monto Prometido
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
                  N° de cuotas aprobadas
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={numeroCuotas}
                  onChange={(e) => setNumeroCuotas(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm dato-numerico"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                />
              </div>
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Modalidad de Pago
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: "var(--color-borde-fuerte)" }}
              >
                <option value="">-- Ninguna --</option>
                {MODALIDADES_PAGO.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.codigo} - {m.descripcion}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Tipo de negociación
                </label>
                <select
                  value={tipoNegociacion}
                  onChange={(e) => setTipoNegociacion(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                >
                  <option value="">-- Ninguno --</option>
                  {TIPOS_NEGOCIACION.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Beneficio
                </label>
                <select
                  value={beneficio}
                  onChange={(e) => setBeneficio(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                >
                  <option value="">-- Ninguno --</option>
                  {BENEFICIOS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Status PDP
                </label>
                <select
                  value={statusPdp}
                  onChange={(e) => setStatusPdp(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                >
                  <option value="">-- Ninguno --</option>
                  {STATUS_PDP.map((s) => (
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
                  Status Pago
                </label>
                <select
                  value={statusPago}
                  onChange={(e) => setStatusPago(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-borde-fuerte)" }}
                >
                  <option value="">-- Ninguno --</option>
                  {STATUS_PAGO.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                className="text-xs font-medium block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Fecha de la promesa
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-borde-fuerte)",
                  colorScheme: "light",
                }}
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
                    className="text-sm p-3 rounded"
                    style={{ background: "#fef2f2", color: "#b91c1c" }}
                  >
                    ¿Eliminar esta promesa de pago? No se puede deshacer. La
                    gestión que quedó registrada en el Historial no se borra
                    junto con esto.
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
              <button
                onClick={guardar}
                disabled={guardando || confirmandoBorrado}
                className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                style={{ background: AZUL_BOTON }}
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
