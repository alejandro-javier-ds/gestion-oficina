// components/dashboard/FeedActividadReciente.tsx
// Feed en vivo de las últimas gestiones.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";

type FilaFeed = {
  id: number;
  fecha_hora: string;
  gestor: string;
  cliente: string;
  categoria: string | null;
  codigo_razon: string | null;
};

const COLOR_CATEGORIA: Record<string, string> = {
  TAT: "chip-exito",
  MCT: "chip-accion",
  TIN: "chip-alerta",
};

function formatearHaceTiempo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diffMs / 60000);

  if (minutos < 1) return "Hace un momento";
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}

export default function FeedActividadReciente({
  filas,
  onEditar,
  onEliminar,
}: {
  filas: FilaFeed[];
  onEditar?: (f: FilaFeed) => void;
  onEliminar?: (f: FilaFeed) => void;
}) {
  const [rolPermitido, setRolPermitido] = useState(false);

  useEffect(() => {
    fetch("/api/sesion")
      .then((res) => res.json())
      .then((data) =>
        setRolPermitido(
          data.sesion?.rol === "administrador" ||
            data.sesion?.rol === "supervisor",
        ),
      );
  }, []);

  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-4"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Actividad reciente
      </p>

      <AnimatePresence mode="wait">
        {filas.length === 0 ? (
          <motion.p
            key="vacio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-sm py-6 text-center"
            style={{ color: "var(--color-texto-tenue)" }}
          >
            Aún no hay gestiones registradas.
          </motion.p>
        ) : (
          <motion.ul
            key="lista"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {filas.map((f, i) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1 basis-[140px]">
                  <p className="text-sm font-medium truncate">{f.cliente}</p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    {f.gestor} · {formatearHaceTiempo(f.fecha_hora)}
                  </p>
                  {f.codigo_razon && (
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--color-texto-tenue)" }}
                    >
                      {f.codigo_razon}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {f.categoria && (
                    <span
                      className={`chip ${COLOR_CATEGORIA[f.categoria] ?? "chip-neutral"}`}
                    >
                      {f.categoria}
                    </span>
                  )}
                  {rolPermitido && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditar?.(f)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Editar"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onEliminar?.(f)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Eliminar"
                        style={{ color: "#b91c1c" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
