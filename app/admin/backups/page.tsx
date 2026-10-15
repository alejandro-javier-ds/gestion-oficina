// app/admin/backups/page.tsx
// Sección de Backups en el Panel Admin. Lista respaldos existentes,
// botón para crear uno nuevo, y descarga individual. Exclusivo
// Administrador (el propio SidebarAdmin ya lo debería mostrar solo
// para ese rol, y la API rechaza a cualquier otro por las dudas).

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Download, RefreshCw, HardDrive, Upload } from "lucide-react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";
import { formatearFechaHoraLima } from "@/lib/fecha-lima";

type Respaldo = {
  nombre: string;
  tamanoMB: number;
  fecha: string;
};

function formatearFecha(iso: string): string {
  return formatearFechaHoraLima(iso, {
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
  const [recuperando, setRecuperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargarRespaldos() {
    fetch("/api/admin/backups")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "No se pudieron cargar los respaldos.");
          return;
        }
        setRespaldos(data.respaldos ?? []);
      })
      .catch(() => setError("No se pudieron cargar los respaldos."))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarRespaldos();
  }, []);

  async function crearRespaldo() {
    setCreando(true);
    setMensaje(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const data = await res.json();

      if (data.localOk) {
        setMensaje(
          `Respaldo local creado y validado: ${data.nombre} (${data.tamanoMB} MB).`,
        );
        if (!data.blobOk) {
          setError(
            "Azure Blob no confirmó la copia. El respaldo local se conserva; puedes volver a intentar con «Recuperar en Azure Blob».",
          );
        }
        setCargando(true);
        cargarRespaldos();
        return;
      }

      setError(data.error ?? "No se pudo crear el respaldo.");
    } catch {
      setError("No se pudo crear el respaldo.");
    } finally {
      setCreando(false);
    }
  }

  async function recuperarRespaldosBlob() {
    setRecuperando(true);
    setMensaje(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/backups/recuperar-blob", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudieron recuperar los respaldos.");
        return;
      }

      setMensaje(
        `Revisados ${data.revisados}: ${data.copiados} copiados a Azure Blob Storage y ${data.existentes} ya estaban guardados.`,
      );
      if (data.errores?.length) {
        const nombres = data.errores
          .slice(0, 3)
          .map((respaldo: { nombre: string }) => respaldo.nombre)
          .join(", ");
        setError(
          `${data.errores.length} respaldo(s) no se pudieron copiar. ${nombres}`,
        );
      }
      setCargando(true);
      cargarRespaldos();
    } catch {
      setError("No se pudieron recuperar los respaldos.");
    } finally {
      setRecuperando(false);
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={recuperarRespaldosBlob}
            disabled={recuperando || creando}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{
              border: "1px solid var(--color-borde-fuerte)",
              color: "var(--color-accion)",
            }}
            title="Copia los respaldos locales que aún no están en Azure Blob Storage, sin sobrescribir los existentes."
          >
            <Upload size={15} className={recuperando ? "animate-pulse" : ""} />
            {recuperando ? "Recuperando..." : "Recuperar en Azure Blob"}
          </button>
          <button
            onClick={crearRespaldo}
            disabled={creando || recuperando}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-accion)" }}
          >
            <RefreshCw size={15} className={creando ? "animate-spin" : ""} />
            {creando ? "Creando..." : "Crear respaldo"}
          </button>
        </div>
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
