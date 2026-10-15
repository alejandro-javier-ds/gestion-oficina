// app/admin/whatsapp/historial/page.tsx
// Historial de campañas de WhatsApp Masivo.
// Permite buscar, filtrar y consultar el detalle de una campaña.
// No realiza envíos.

"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Search, AlertTriangle } from "lucide-react";

import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";
import { formatearFechaHoraLima } from "@/lib/fecha-lima";

type Campana = {
  id: number;
  fecha_creacion: string;
  usuario_creador: string | null;
  campana: string;
  gestor: string | null;
  desde: string;
  hasta: string;
  numero_salida: string;
  total_seleccionados: number;
  total_preparados: number;
  total_sin_telefono: number;
  total_fallidos: number;
  total_enviados: number;
  total_inciertos: number;
  estado: string;
};

type Destinatario = {
  id: number;
  idc: string;
  cliente: string;
  gestor: string | null;
  telefono_destino: string | null;
  tipo_telefono: string | null;
  estado: string;
  error: string | null;
  fecha_procesamiento: string;
};

const ESTADOS = [
  "",
  "PREPARADA",
  "PREPARADA_CON_ERRORES",
  "ENVIANDO",
  "ENVIADA",
  "ENVIADA_CON_ERRORES",
  "REQUIERE_REVISION",
  "ERROR",
  "COMPLETADA",
  "COMPLETADA_CON_ERRORES",
  "CANCELADA",
];

function estadoEtiqueta(estado: string) {
  return estado
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function estadoClase(estado: string) {
  if (
    estado === "PREPARADA" ||
    estado === "COMPLETADA" ||
    estado === "ENVIADA"
  ) {
    return "chip chip-exito";
  }

  if (
    estado === "PREPARADA_CON_ERRORES" ||
    estado === "COMPLETADA_CON_ERRORES" ||
    estado === "REQUIERE_REVISION" ||
    estado === "ENVIADA_CON_ERRORES" ||
    estado === "ERROR"
  ) {
    return "chip chip-alerta";
  }

  if (estado === "CANCELADA") {
    return "chip chip-neutral";
  }

  return "chip chip-accion";
}

function estadoDestinatarioEtiqueta(estado: string) {
  if (estado === "PREPARADO") return "Preparado";
  if (estado === "ENVIANDO") return "En proceso";
  if (estado === "ENVIADO") return "Enviado · confirmado";
  if (estado === "ERROR") return "Fallido · confirmado";
  if (estado === "INCIERTO") return "Incierto · no reenviar sin verificar";
  if (estado === "SIN_TELEFONO") return "Sin teléfono";
  if (estado === "EXCLUIDO") return "Retirado antes del envío";
  return estadoEtiqueta(estado);
}

export default function HistorialWhatsappPage() {
  const [campanas, setCampanas] = useState<Campana[]>([]);

  const [busqueda, setBusqueda] = useState("");

  const [estado, setEstado] = useState("");

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [campanaSeleccionada, setCampanaSeleccionada] =
    useState<Campana | null>(null);

  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);

  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarHistorial = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const params = new URLSearchParams();

      if (busqueda.trim()) {
        params.set("q", busqueda.trim());
      }

      if (estado) {
        params.set("estado", estado);
      }

      const response = await fetch(
        `/api/whatsapp/historial?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo cargar el historial.");
      }

      setCampanas(data.campanas ?? []);
    } catch (err) {
      setCampanas([]);

      setError(
        err instanceof Error ? err.message : "Error al cargar historial.",
      );
    } finally {
      setCargando(false);
    }
  }, [busqueda, estado]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarHistorial();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [cargarHistorial]);

  async function abrirDetalle(campana: Campana) {
    try {
      setCampanaSeleccionada(campana);

      setCargandoDetalle(true);

      const response = await fetch(`/api/whatsapp/historial?id=${campana.id}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo cargar el detalle.");
      }

      setDestinatarios(data.destinatarios ?? []);
    } catch (err) {
      setDestinatarios([]);
      setError(err instanceof Error ? err.message : "Error al cargar detalle.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <HeaderPanelAdmin
        titulo="Historial de WhatsApp"
        descripcion="Consulta las campañas preparadas y sus destinatarios."
      />

      <div className="mt-4 space-y-4">
        <section className="tarjeta p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="buscar-historial-whatsapp"
                className="mb-1.5 block text-sm font-semibold"
              >
                Buscar campañas
              </label>

              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                />

                <input
                  id="buscar-historial-whatsapp"
                  type="text"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar por campaña, gestor, número o usuario..."
                  className="whatsapp-buscador"
                />
              </div>
            </div>

            <div className="w-full xl:w-64">
              <label className="whatsapp-label">Estado</label>

              <select
                value={estado}
                onChange={(event) => setEstado(event.target.value)}
                className="whatsapp-select mt-1"
              >
                {ESTADOS.map((item) => (
                  <option key={item || "todos"} value={item}>
                    {item ? estadoEtiqueta(item) : "Todos los estados"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <span className="chip chip-neutral">
              {campanas.length} campañas
            </span>
          </div>
        </section>

        <section className="tarjeta overflow-hidden">
          <div
            className="border-b p-4 sm:p-5"
            style={{
              borderColor: "var(--color-borde)",
            }}
          >
            <h2 className="text-base font-semibold">Campañas</h2>

            <p
              className="mt-1 text-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Selecciona una campaña para consultar sus destinatarios.
            </p>
          </div>

          {cargando ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm">
                <Clock3
                  size={17}
                  className="animate-pulse"
                  style={{
                    color: "var(--color-accion)",
                  }}
                />
                <span
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  Cargando historial...
                </span>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p
                className="text-sm font-semibold"
                style={{
                  color: "var(--color-error)",
                }}
              >
                {error}
              </p>
            </div>
          ) : campanas.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center p-8 text-center">
              <div>
                <p className="text-sm font-semibold">
                  No hay campañas registradas.
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  Las campañas preparadas aparecerán aquí.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="whatsapp-tabla">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Campaña</th>
                    <th>Gestor</th>
                    <th>Número de salida</th>
                    <th>Destinatarios</th>
                    <th>Preparados</th>
                    <th>Enviados</th>
                    <th>Por verificar</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {campanas.map((campana) => (
                    <tr
                      key={campana.id}
                      className="cursor-pointer"
                      onClick={() => abrirDetalle(campana)}
                    >
                      <td className="dato-numerico font-medium">
                        #{campana.id}
                      </td>

                      <td className="whitespace-nowrap">
                        {formatearFechaHoraLima(campana.fecha_creacion, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>

                      <td className="font-medium">{campana.campana}</td>

                      <td>{campana.gestor || "Todos los gestores"}</td>

                      <td className="dato-numerico">
                        +51 {campana.numero_salida}
                      </td>

                      <td className="dato-numerico">
                        {campana.total_seleccionados}
                      </td>

                      <td className="dato-numerico">
                        {campana.total_preparados}
                      </td>

                      <td className="dato-numerico">
                        {campana.total_enviados}
                      </td>

                      <td className="dato-numerico">{campana.total_inciertos}</td>

                      <td>
                        <span className={estadoClase(campana.estado)}>
                          {estadoEtiqueta(campana.estado)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {campanaSeleccionada && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCampanaSeleccionada(null);
            }
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
            style={{
              background: "var(--color-superficie)",
              boxShadow: "var(--sombra-lg)",
            }}
          >
            <div
              className="flex items-start justify-between gap-4 border-b p-5"
              style={{
                borderColor: "var(--color-borde)",
              }}
            >
              <div>
                <h2 className="text-lg font-semibold">
                  Campaña #{campanaSeleccionada.id}
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  {campanaSeleccionada.campana}
                  {" · "}
                  {campanaSeleccionada.gestor || "Todos los gestores"}
                </p>
              </div>

              <button
                type="button"
                className="text-sm font-medium"
                style={{
                  color: "var(--color-texto-suave)",
                }}
                onClick={() => setCampanaSeleccionada(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-[var(--color-borde)] sm:grid-cols-5">
              <div className="bg-[var(--color-superficie)] p-4">
                <p className="text-xs text-zinc-500">Seleccionados</p>
                <p className="mt-1 text-lg font-semibold">
                  {campanaSeleccionada.total_seleccionados}
                </p>
              </div>

              <div className="bg-[var(--color-superficie)] p-4">
                <p className="text-xs text-zinc-500">Preparados</p>
                <p className="mt-1 text-lg font-semibold">
                  {campanaSeleccionada.total_preparados}
                </p>
              </div>

              <div className="bg-[var(--color-superficie)] p-4">
                <p className="text-xs text-zinc-500">Con problemas</p>
                <p className="mt-1 text-lg font-semibold">
                  {campanaSeleccionada.total_sin_telefono +
                    campanaSeleccionada.total_fallidos}
                </p>
              </div>

              <div className="bg-[var(--color-superficie)] p-4">
                <p className="text-xs text-zinc-500">Enviados</p>
                <p className="mt-1 text-lg font-semibold">
                  {campanaSeleccionada.total_enviados}
                </p>
              </div>

              <div className="bg-[var(--color-superficie)] p-4">
                <p className="text-xs text-zinc-500">Por verificar</p>
                <p className="mt-1 text-lg font-semibold">
                  {campanaSeleccionada.total_inciertos}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {cargandoDetalle ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <Clock3
                    size={18}
                    className="animate-pulse"
                    style={{
                      color: "var(--color-accion)",
                    }}
                  />
                </div>
              ) : (
                <table className="whatsapp-tabla">
                  <thead>
                    <tr>
                      <th>IDC</th>
                      <th>Cliente</th>
                      <th>Gestor</th>
                      <th>Teléfono</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {destinatarios.map((destinatario) => (
                      <tr key={destinatario.id}>
                        <td className="dato-numerico">{destinatario.idc}</td>

                        <td className="font-medium">{destinatario.cliente}</td>

                        <td>{destinatario.gestor || "—"}</td>

                        <td className="dato-numerico">
                          {destinatario.telefono_destino || "Sin teléfono"}
                        </td>

                        <td>{destinatario.tipo_telefono || "—"}</td>

                        <td>
                          <div className="flex items-center gap-2">
                            {destinatario.estado === "PREPARADO" ||
                            destinatario.estado === "ENVIADO" ? (
                              <CheckCircle2
                                size={15}
                                style={{
                                  color: "var(--color-exito)",
                                }}
                              />
                            ) : (
                              <AlertTriangle
                                size={15}
                                style={{
                                  color: "var(--color-alerta)",
                                }}
                              />
                            )}

                            <span className="text-xs">
                              {estadoDestinatarioEtiqueta(destinatario.estado)}
                            </span>
                          </div>

                          {destinatario.error && (
                            <p
                              className="mt-1 text-xs"
                              style={{
                                color: "var(--color-error)",
                              }}
                            >
                              {destinatario.error}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
