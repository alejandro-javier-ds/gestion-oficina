// app/admin/portafolio/page.tsx
// Subir portafolio nuevo. Responsive completo + Framer Motion: la
// tarjeta de "último importado" hace crossfade entre carga/dato, el
// aviso de nombre duplicado y el mensaje de error entran/salen
// animados, el resumen de importación aparece con sus filas en
// cascada, y el historial reciente entra fila por fila con stagger.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  History as HistoryIcon,
  Clock,
} from "lucide-react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";

type ResumenImport = {
  totalFilasLeidas: number;
  filasPermitidas: number;
  cuentasNuevas: number;
  cuentasActualizadas: number;
  cuentasDadasDeBaja: number;
};

type ImportRegistrado = {
  id: number;
  nombre_archivo: string;
  fecha_import: string;
  cuentas_nuevas: number;
  cuentas_actualizadas: number;
  cuentas_dadas_de_baja: number;
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortafolioAdminPage() {
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(
    null,
  );
  const [subiendo, setSubiendo] = useState(false);
  const [resumenImport, setResumenImport] = useState<ResumenImport | null>(
    null,
  );
  const [errorImport, setErrorImport] = useState<string | null>(null);

  const [historial, setHistorial] = useState<ImportRegistrado[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  function cargarHistorial() {
    setCargandoHistorial(true);
    fetch("/api/admin/portafolio/historial?limite=5")
      .then((res) => res.json())
      .then((data) => setHistorial(data.historial ?? []))
      .finally(() => setCargandoHistorial(false));
  }

  useEffect(() => {
    cargarHistorial();
  }, []);

  const ultimoImportado = historial[0] ?? null;

  const nombreYaImportado =
    archivoSeleccionado != null &&
    historial.some((h) => h.nombre_archivo === archivoSeleccionado.name);

  async function subirPortafolio() {
    if (!archivoSeleccionado) return;

    const mensajeConfirmacion = nombreYaImportado
      ? `Ya existe una importación previa con el nombre "${archivoSeleccionado.name}". ¿Seguro que quieres importarlo de nuevo?`
      : `¿Seguro que quieres importar "${archivoSeleccionado.name}"? Esto actualizará la cartera completa.`;

    const confirmado = window.confirm(mensajeConfirmacion);
    if (!confirmado) return;

    setSubiendo(true);
    setErrorImport(null);
    setResumenImport(null);

    const formData = new FormData();
    formData.append("archivo", archivoSeleccionado);

    const res = await fetch("/api/admin/importar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setSubiendo(false);

    if (!res.ok) {
      setErrorImport(data.error ?? "Ocurrió un error al importar el archivo.");
      return;
    }

    setResumenImport(data.resumen);
    setArchivoSeleccionado(null);
    cargarHistorial();
  }

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <HeaderPanelAdmin
        titulo="Subir portafolio nuevo"
        descripcion='Sube el Excel mensual del banco (hoja "Cuentas") para actualizar la cartera.'
      />
      <div className="tarjeta p-4 mb-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--color-accion-suave)" }}
        >
          <Clock size={18} style={{ color: "var(--color-accion)" }} />
        </div>
        <AnimatePresence mode="wait">
          {cargandoHistorial ? (
            <motion.p
              key="cargando"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Cargando último portafolio importado...
            </motion.p>
          ) : ultimoImportado ? (
            <motion.div
              key="dato"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <p
                className="text-xs uppercase tracking-wide font-medium"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Último portafolio importado
              </p>
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--color-texto)" }}
              >
                {ultimoImportado.nombre_archivo}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-texto-suave)" }}
              >
                {formatearFecha(ultimoImportado.fecha_import)}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="ninguno"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Todavía no se ha importado ningún portafolio.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tarjeta de subida */}
        <div className="tarjeta p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Upload size={20} style={{ color: "var(--color-accion)" }} />
            <h2
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Archivo del portafolio
            </h2>
          </div>

          <p
            className="text-sm mb-5"
            style={{ color: "var(--color-texto-suave)" }}
          >
            El archivo debe tener una hoja llamada exactamente{" "}
            <strong>&quot;Cuentas&quot;</strong>. Las cuentas nuevas se agregan,
            las existentes se actualizan, y las que ya no aparezcan se marcan
            como inactivas (sin perder su historial de gestiones).
          </p>

          <label
            className="flex flex-col items-center justify-center gap-2 py-6 sm:py-8 px-4 rounded-lg cursor-pointer transition-colors"
            style={{
              border: `1.5px dashed ${archivoSeleccionado ? "var(--color-accion)" : "var(--color-borde-fuerte)"}`,
              background: archivoSeleccionado
                ? "var(--color-accion-suave)"
                : "var(--color-fondo-sutil)",
            }}
          >
            <FileSpreadsheet
              size={28}
              style={{
                color: archivoSeleccionado
                  ? "var(--color-accion)"
                  : "var(--color-texto-tenue)",
              }}
            />
            {archivoSeleccionado ? (
              <div className="text-center px-2">
                <p
                  className="text-sm font-medium break-all"
                  style={{ color: "var(--color-accion)" }}
                >
                  {archivoSeleccionado.name}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  {formatearTamano(archivoSeleccionado.size)}
                </p>
              </div>
            ) : (
              <>
                <p
                  className="text-sm font-medium text-center"
                  style={{ color: "var(--color-texto)" }}
                >
                  Toca para elegir un archivo
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Formato .xlsx
                </p>
              </>
            )}
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) =>
                setArchivoSeleccionado(e.target.files?.[0] ?? null)
              }
              className="hidden"
            />
          </label>

          <AnimatePresence>
            {nombreYaImportado && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-start gap-2 p-3 rounded-lg overflow-hidden"
                style={{ background: "var(--color-alerta-suave)" }}
              >
                <AlertCircle
                  size={16}
                  style={{
                    color: "var(--color-alerta)",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                <p className="text-sm" style={{ color: "var(--color-alerta)" }}>
                  Ya existe una importación previa con este mismo nombre de
                  archivo.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={subirPortafolio}
            disabled={!archivoSeleccionado || subiendo}
            className="boton-primario w-full sm:w-auto flex items-center justify-center gap-2 mt-5"
          >
            <Upload size={16} />
            {subiendo ? "Procesando..." : "Importar portafolio"}
          </button>

          <AnimatePresence>
            {errorImport && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-start gap-2 p-3 rounded-lg overflow-hidden"
                style={{ background: "var(--color-error-suave)" }}
              >
                <AlertCircle
                  size={16}
                  style={{
                    color: "var(--color-error)",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                <p className="text-sm" style={{ color: "var(--color-error)" }}>
                  {errorImport}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tarjeta de resultado de la última importación de esta sesión */}
        <div className="tarjeta p-4 sm:p-5 md:p-6">
          <h2
            className="font-semibold mb-5"
            style={{ color: "var(--color-texto)" }}
          >
            Resultado de la importación
          </h2>

          <AnimatePresence mode="wait">
            {!resumenImport ? (
              <motion.div
                key="vacio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center justify-center gap-2 py-10"
              >
                <FileSpreadsheet
                  size={28}
                  style={{ color: "var(--color-texto-tenue)" }}
                />
                <p
                  className="text-sm text-center max-w-xs"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Sube un archivo para ver aquí el resumen de la importación.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="resultado"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 mb-5 p-3 rounded-lg"
                  style={{ background: "var(--color-exito-suave)" }}
                >
                  <CheckCircle2
                    size={18}
                    style={{ color: "var(--color-exito)" }}
                  />
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-exito)" }}
                  >
                    Importación completada correctamente
                  </p>
                </motion.div>

                <div className="space-y-3">
                  {[
                    {
                      etiqueta: "Filas leídas del Excel",
                      valor: resumenImport.totalFilasLeidas,
                    },
                    {
                      etiqueta: "Filas de funcionarios permitidos",
                      valor: resumenImport.filasPermitidas,
                    },
                    {
                      etiqueta: "Cuentas nuevas",
                      valor: resumenImport.cuentasNuevas,
                      acento: "positivo" as const,
                    },
                    {
                      etiqueta: "Cuentas actualizadas",
                      valor: resumenImport.cuentasActualizadas,
                    },
                    {
                      etiqueta: "Cuentas dadas de baja",
                      valor: resumenImport.cuentasDadasDeBaja,
                      acento: "alerta" as const,
                    },
                  ].map((fila, i) => (
                    <motion.div
                      key={fila.etiqueta}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.05 + i * 0.05 }}
                    >
                      <FilaResumen
                        etiqueta={fila.etiqueta}
                        valor={fila.valor}
                        acento={fila.acento}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="tarjeta mt-4">
        <div
          className="px-4 sm:px-5 py-4 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--color-borde)" }}
        >
          <HistoryIcon size={18} style={{ color: "var(--color-accion)" }} />
          <h2 className="font-semibold" style={{ color: "var(--color-texto)" }}>
            Historial reciente
          </h2>
        </div>

        {cargandoHistorial ? (
          <p
            className="text-sm p-5"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Cargando historial...
          </p>
        ) : historial.length === 0 ? (
          <p
            className="text-sm p-5"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Sin importaciones registradas todavía.
          </p>
        ) : (
          <div className="p-2">
            {historial.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 rounded-lg transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--color-fondo-sutil)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--color-texto)" }}
                  >
                    {h.nombre_archivo}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    {formatearFecha(h.fecha_import)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <span className="chip chip-exito">
                    +{h.cuentas_nuevas} nuevas
                  </span>
                  <span className="chip chip-neutral">
                    {h.cuentas_actualizadas} actualizadas
                  </span>
                  {h.cuentas_dadas_de_baja > 0 && (
                    <span className="chip chip-alerta">
                      -{h.cuentas_dadas_de_baja} baja
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilaResumen({
  etiqueta,
  valor,
  acento,
}: {
  etiqueta: string;
  valor: number;
  acento?: "positivo" | "alerta";
}) {
  const color =
    acento === "positivo"
      ? "var(--color-exito)"
      : acento === "alerta"
        ? "var(--color-alerta)"
        : "var(--color-marca)";

  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: "1px solid var(--color-borde)" }}
    >
      <span className="text-sm" style={{ color: "var(--color-texto-suave)" }}>
        {etiqueta}
      </span>
      <span className="text-sm font-semibold dato-numerico" style={{ color }}>
        {valor}
      </span>
    </div>
  );
}
