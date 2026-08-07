// app/admin/backups/page.tsx
// Sección de Backups en el Panel Admin. Lista respaldos existentes,
// botón para crear uno nuevo, y descarga individual. Exclusivo
// Administrador (el propio SidebarAdmin ya lo debería mostrar solo
// para ese rol, y la API rechaza a cualquier otro por las dudas).

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Download, RefreshCw, HardDrive } from "lucide-react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";

type Respaldo = {
  nombre: string;
  tamanoMB: number;
  fecha: string;
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return fecha.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BackupsPage() {
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargarRespaldos() {
    setCargando(true);
    setError(null);
    fetch("/api/admin/backups")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "No se pudieron cargar los respaldos.");
          return;
        }
        setRespaldos(data.respaldos ?? []);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarRespaldos();
  }, []);

  async function crearRespaldo() {
    setCreando(true);
    setMensaje(null);
    setError(null);

    const res = await fetch("/api/admin/backups", { method: "POST" });
    const data = await res.json();

    setCreando(false);

    if (res.ok) {
      setMensaje(`Respaldo creado: ${data.nombre} (${data.tamanoMB} MB)`);
      cargarRespaldos();
    } else {
      setError(data.error ?? "No se pudo crear el respaldo.");
    }
  }

  function descargar(nombre: string) {
    window.open(`/api/admin/backups/${encodeURIComponent(nombre)}`, "_blank");
  }

  return (
    <div className="p-6">
      <HeaderPanelAdmin
        titulo="Backups"
        descripcion="Copias de respaldo de la base de datos — se guardan en este servidor, se mantienen los últimos 30."
      />

      <div className="tarjeta p-4 sm:p-5 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="rounded p-2"
            style={{ background: "var(--color-accion-suave)" }}
          >
            <Database size={18} style={{ color: "var(--color-accion)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold">Crear un respaldo ahora</p>
            <p
              className="text-xs"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Copia inmediata de la base de datos actual, sin importar el
              respaldo automático diario.
            </p>
          </div>
        </div>
        <button
          onClick={crearRespaldo}
          disabled={creando}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--color-accion)" }}
        >
          <RefreshCw size={15} className={creando ? "animate-spin" : ""} />
          {creando ? "Creando..." : "Crear respaldo"}
        </button>
      </div>

      {mensaje && (
        <div
          className="tarjeta p-3 mb-4 text-sm"
          style={{ color: "var(--color-exito, #15803d)" }}
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div className="tarjeta p-3 mb-4 text-sm" style={{ color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <div className="tarjeta p-4 sm:p-5">
        <p
          className="text-xs uppercase tracking-wide font-medium mb-4"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Respaldos existentes {respaldos.length > 0 && `(${respaldos.length})`}
        </p>

        <AnimatePresence mode="wait">
          {cargando && (
            <motion.p
              key="cargando"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Cargando respaldos...
            </motion.p>
          )}

          {!cargando && respaldos.length === 0 && !error && (
            <motion.p
              key="vacio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm py-6 text-center"
              style={{ color: "var(--color-texto-tenue)" }}
            >
              Aún no hay respaldos. Crea el primero con el botón de arriba.
            </motion.p>
          )}

          {!cargando && respaldos.length > 0 && (
            <motion.ul
              key="lista"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y"
              style={{ borderColor: "var(--color-borde)" }}
            >
              {respaldos.map((r, i) => (
                <motion.li
                  key={r.nombre}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.15,
                    delay: Math.min(i * 0.02, 0.2),
                  }}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HardDrive
                      size={16}
                      style={{ color: "var(--color-texto-tenue)" }}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatearFecha(r.fecha)}
                      </p>
                      <p
                        className="text-xs dato-numerico"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        {r.nombre} · {r.tamanoMB} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => descargar(r.nombre)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium shrink-0"
                    style={{
                      border: "1px solid var(--color-borde-fuerte)",
                      color: "var(--color-accion)",
                    }}
                  >
                    <Download size={13} />
                    Descargar
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
