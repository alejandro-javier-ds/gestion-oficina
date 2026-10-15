"use client";

import { useEffect, useState } from "react";
import type {
  SeguimientoCliente,
  IntentoWhatsapp,
} from "@/lib/whatsapp/seguimiento";
import { formatearFechaHoraLima } from "@/lib/fecha-lima";

const colores = {
  COMPLETADO: "#166534",
  PARCIAL: "#854d0e",
  PENDIENTE: "#475569",
  REVISAR: "#92400e",
};
const fondos = {
  COMPLETADO: "#dcfce7",
  PARCIAL: "#fef9c3",
  PENDIENTE: "#f1f5f9",
  REVISAR: "#fef3c7",
};
export function fechaIntentoWhatsapp(fecha: string | null) {
  if (!fecha) return "Sin intento";
  const valor = formatearFechaHoraLima(fecha, {
    dateStyle: "short",
    timeStyle: "short",
  });
  return valor === fecha ? "Fecha no disponible" : valor;
}
export default function SeguimientoClienteWhatsapp({
  seguimiento,
  idc,
}: {
  seguimiento?: SeguimientoCliente;
  idc: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {seguimiento && (
        <>
          <span
            className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              color: colores[seguimiento.estado],
              background: fondos[seguimiento.estado],
            }}
          >
            {seguimiento.estado}
          </span>
          <span className="text-[11px]">
            {seguimiento.enviados}/{seguimiento.total} enviados ·{" "}
            {seguimiento.pendientes} pendientes
            {seguimiento.inciertos > 0 && ` · ${seguimiento.inciertos} por verificar`}
          </span>
        </>
      )}
      <button
        type="button"
        className="text-[11px] font-medium"
        style={{ color: "var(--color-accion)" }}
        onClick={() => setAbierto(true)}
      >
        Historial
      </button>
      {abierto && (
        <HistorialClienteWhatsapp
          idc={idc}
          campanaId={seguimiento?.campanaId ?? null}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}
function HistorialClienteWhatsapp({
  idc,
  campanaId,
  onCerrar,
}: {
  idc: string;
  campanaId: number | null;
  onCerrar: () => void;
}) {
  const [soloCampana, setSoloCampana] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [intentos, setIntentos] = useState<IntentoWhatsapp[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ idc, pagina: String(pagina) });
    if (soloCampana && campanaId) params.set("campanaId", String(campanaId));
    void fetch(`/api/whatsapp/seguimiento?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.error ?? "No se pudo cargar el historial.");
        if (!controller.signal.aborted) {
          setIntentos(data.intentos ?? []);
          setHayMas(data.hayMas ?? false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el historial.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [idc, campanaId, soloCampana, pagina]);
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Historial de envíos del cliente"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="tarjeta max-h-[90vh] w-full max-w-4xl overflow-auto p-5 text-left">
        <div className="flex justify-between gap-3">
          <h3 className="font-semibold">Historial de envíos · {idc}</h3>
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        <div className="my-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={!soloCampana ? "boton-primario" : "boton-secundario"}
            onClick={() => {
              setCargando(true);
              setError("");
              setSoloCampana(false);
              setPagina(1);
            }}
          >
            Historial general
          </button>
          <button
            type="button"
            disabled={!campanaId}
            className={soloCampana ? "boton-primario" : "boton-secundario"}
            onClick={() => {
              setCargando(true);
              setError("");
              setSoloCampana(true);
              setPagina(1);
            }}
          >
            Campaña #{campanaId ?? "—"}
          </button>
        </div>
        <p
          className="mb-3 text-xs"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Enviado registra la confirmación de envío disponible. Entregado y
          leído requieren evidencia adicional. Estos envíos no registran una
          gestión de cobranza.
        </p>
        {cargando ? (
          <p>Cargando historial...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Teléfono</th>
                    <th className="p-2 text-left">Estado</th>
                    <th className="p-2 text-left">Último intento</th>
                    <th className="p-2 text-left">Campaña</th>
                    <th className="p-2 text-left">Remitente</th>
                  </tr>
                </thead>
                <tbody>
                  {intentos.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="p-2">
                        {i.telefono_destino ?? "Sin teléfono"}
                      </td>
                      <td className="p-2">
                        <span>
                          {i.estado === "ENVIADO"
                            ? "Enviado"
                            : i.estado === "ENVIANDO"
                              ? "En proceso / verificar"
                              : i.estado === "ERROR"
                                ? "Fallido"
                                : i.estado === "INCIERTO"
                                  ? "Incierto · no reenviar sin verificar"
                                : i.estado === "EXCLUIDO"
                                  ? "Retirado antes de enviar"
                                  : "Pendiente"}
                        </span>
                        {i.error && (
                          <p className="max-w-xs text-xs">{i.error}</p>
                        )}
                      </td>
                      <td className="p-2">
                        {fechaIntentoWhatsapp(i.fecha_procesamiento)}
                      </td>
                      <td className="p-2">
                        #{i.campana_id} · {i.campana}
                      </td>
                      <td className="p-2">{i.numero_salida}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!intentos.length && <p className="p-3">Sin envíos registrados.</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="boton-secundario"
                disabled={pagina === 1}
                onClick={() => {
                  setCargando(true);
                  setError("");
                  setPagina((p) => p - 1);
                }}
              >
                Anterior
              </button>
              <span>Página {pagina}</span>
              <button
                type="button"
                className="boton-secundario"
                disabled={!hayMas}
                onClick={() => {
                  setCargando(true);
                  setError("");
                  setPagina((p) => p + 1);
                }}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
