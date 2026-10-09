// app/admin/exportar/page.tsx
// Pantalla de exportación con rango de fechas, tarjetas de contexto,
// y vista previa del Excel. Agregado: "Teléfono" en COLUMNAS, justo
// después de IDC.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Download,
  TrendingUp,
  Clock,
  History,
  Table2,
} from "lucide-react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";

type FilaCompleta = {
  fecha_hora: string;
  gestor: string;
  funcionario: string | null;
  cliente: string;
  idc: string;
  telefono: string | null;
  categoria: string | null;
  codigo_razon: string | null;
  monto_pagado: number | null;
  observacion: string | null;
  mtodeuda_sol: number | null;
  diasmora: number | null;
  rango_mora: string | null;
  segmentacion: string | null;
  descproducto: string | null;
  estado_cartera: string | null;
  etapa_procesal: string | null;
  prioridad: string | null;
  direccion: string | null;
  distrito: string | null;
  departamento: string | null;
  router: string | null;
  nivel_riesgo: string | null;
};

type UltimaExportacion = {
  fecha_hora: string;
  usuario: string;
};

const COLUMNAS: { clave: keyof FilaCompleta; etiqueta: string }[] = [
  { clave: "fecha_hora", etiqueta: "Fecha y Hora" },
  { clave: "gestor", etiqueta: "Gestor" },
  { clave: "funcionario", etiqueta: "Funcionario" },
  { clave: "cliente", etiqueta: "Cliente" },
  { clave: "idc", etiqueta: "IDC" },
  { clave: "telefono", etiqueta: "Teléfono" },
  { clave: "categoria", etiqueta: "Categoría" },
  { clave: "codigo_razon", etiqueta: "Código de Razón" },
  { clave: "monto_pagado", etiqueta: "Monto Pagado (S/)" },
  { clave: "observacion", etiqueta: "Observación" },
  { clave: "mtodeuda_sol", etiqueta: "Monto Deuda (S/)" },
  { clave: "diasmora", etiqueta: "Días Mora" },
  { clave: "rango_mora", etiqueta: "Rango de Mora" },
  { clave: "segmentacion", etiqueta: "Segmentación" },
  { clave: "descproducto", etiqueta: "Producto" },
  { clave: "estado_cartera", etiqueta: "Estado de Cartera" },
  { clave: "etapa_procesal", etiqueta: "Etapa Procesal" },
  { clave: "prioridad", etiqueta: "Prioridad" },
  { clave: "direccion", etiqueta: "Dirección" },
  { clave: "distrito", etiqueta: "Distrito" },
  { clave: "departamento", etiqueta: "Departamento" },
  { clave: "router", etiqueta: "Router" },
  { clave: "nivel_riesgo", etiqueta: "Nivel de Riesgo" },
];

function formatearCelda(valor: unknown, clave: string): string {
  if (valor === null || valor === undefined || valor === "") return "";

  if (clave === "fecha_hora" && typeof valor === "string") {
    const date = new Date(valor);
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .format(date)
        .replace(", ", " ");
    }
  }

  if (typeof valor === "number") return valor.toLocaleString("es-PE");
  return String(valor);
}

function formatearTiempoRelativo(iso: string): string {
  const ahora = new Date().getTime();
  const fecha = new Date(iso).getTime();
  const diferenciaMinutos = Math.floor((ahora - fecha) / (1000 * 60));

  if (diferenciaMinutos < 1) return "Hace un momento";
  if (diferenciaMinutos < 60) return `Hace ${diferenciaMinutos} min`;

  const diferenciaHoras = Math.floor(diferenciaMinutos / 60);
  if (diferenciaHoras < 24) return `Hace ${diferenciaHoras} h`;

  const diferenciaDias = Math.floor(diferenciaHoras / 24);
  return `Hace ${diferenciaDias} d`;
}

function FilaEsqueleto({ indice }: { indice: number }) {
  return (
    <tr
      style={{
        background:
          indice % 2 === 0
            ? "var(--color-superficie)"
            : "var(--color-fondo-sutil)",
      }}
    >
      <td
        className="sticky left-0 px-2 py-2"
        style={{
          background:
            indice % 2 === 0
              ? "var(--color-superficie)"
              : "var(--color-fondo-sutil)",
          borderBottom: "1px solid var(--color-borde)",
          borderRight: "1px solid var(--color-borde)",
        }}
      />
      {Array.from({ length: 6 }).map((_, i) => (
        <td
          key={i}
          className="px-3 py-2"
          style={{
            borderBottom: "1px solid var(--color-borde)",
            borderRight: "1px solid var(--color-borde)",
          }}
        >
          <div
            className="h-3 rounded animate-pulse"
            style={{
              background: "var(--color-fondo-sutil)",
              width: `${50 + ((i * 13) % 40)}%`,
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function ExportarAdminPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [muestra, setMuestra] = useState<FilaCompleta[]>([]);
  const [totalGestiones, setTotalGestiones] = useState(0);
  const [gestionesHoy, setGestionesHoy] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [ultimaExportacion, setUltimaExportacion] =
    useState<UltimaExportacion | null>(null);

  function cargarVistaPrevia() {
    setCargando(true);
    fetch("/api/exportar/vista-previa")
      .then((res) => res.json())
      .then((data) => {
        setMuestra(data.muestra ?? []);
        setTotalGestiones(data.totalGestiones ?? 0);
        setGestionesHoy(data.gestionesHoy ?? 0);
      })
      .finally(() => setCargando(false));
  }

  function cargarUltimaExportacion() {
    fetch("/api/exportar/ultima")
      .then((res) => res.json())
      .then((data) => setUltimaExportacion(data.ultima ?? null));
  }

  useEffect(() => {
    cargarVistaPrevia();
    cargarUltimaExportacion();
  }, []);

  function exportarExcel() {
    const parametros = new URLSearchParams();
    if (desde) parametros.set("desde", desde);
    if (hasta) parametros.set("hasta", hasta);

    const url = `/api/exportar${parametros.toString() ? `?${parametros}` : ""}`;
    window.open(url, "_blank");

    setTimeout(cargarUltimaExportacion, 1000);
  }

  const FILAS_MINIMAS = 14;
  const filasVaciasExtra = Math.max(0, FILAS_MINIMAS - muestra.length);

  const tarjetasStat = [
    {
      icono: <TrendingUp size={14} style={{ color: "var(--color-accion)" }} />,
      etiqueta: "Total registradas",
      valor: totalGestiones,
    },
    {
      icono: <Clock size={14} style={{ color: "var(--color-accion)" }} />,
      etiqueta: "Gestiones hoy",
      valor: gestionesHoy,
    },
  ];

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <HeaderPanelAdmin
        titulo="Exportar gestiones"
        descripcion="Descarga el detalle de gestiones y el resumen de indicadores en Excel."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4 items-start mb-4">
        <div className="tarjeta p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileSpreadsheet
              size={20}
              style={{ color: "var(--color-accion)" }}
            />
            <h2
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Rango de fechas
            </h2>
          </div>

          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Déjalo vacío para exportar todas las gestiones registradas hasta
            hoy.
          </p>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3 sm:gap-4 mb-6">
            <div>
              <label
                className="text-xs font-medium uppercase tracking-wide block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Desde
              </label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="input-estandar w-full sm:w-auto"
                style={{ colorScheme: "light" }}
              />
            </div>
            <div>
              <label
                className="text-xs font-medium uppercase tracking-wide block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="input-estandar w-full sm:w-auto"
                style={{ colorScheme: "light" }}
              />
            </div>
          </div>

          <button
            onClick={exportarExcel}
            className="boton-primario w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Descargar Excel
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-1 xl:grid-cols-1 gap-2.5">
          {tarjetasStat.map((t, i) => (
            <motion.div
              key={t.etiqueta}
              className="tarjeta p-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06, ease: "easeOut" }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {t.icono}
                <p
                  className="text-xs uppercase tracking-wide font-medium truncate"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  {t.etiqueta}
                </p>
              </div>
              <p
                className="text-xl font-bold dato-numerico"
                style={{ color: "var(--color-marca)" }}
              >
                {t.valor}
              </p>
            </motion.div>
          ))}

          <motion.div
            className="tarjeta p-3 col-span-2 sm:col-span-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12, ease: "easeOut" }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <History size={14} style={{ color: "var(--color-accion)" }} />
              <p
                className="text-xs uppercase tracking-wide font-medium"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Última exportación
              </p>
            </div>
            {ultimaExportacion ? (
              <>
                <p
                  className="text-sm font-bold"
                  style={{ color: "var(--color-marca)" }}
                >
                  {formatearTiempoRelativo(ultimaExportacion.fecha_hora)}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  {ultimaExportacion.usuario}
                </p>
              </>
            ) : (
              <p
                className="text-sm"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Aún no se exportó nada
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <div className="tarjeta" style={{ borderRadius: "16px" }}>
        <div
          className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2"
          style={{ borderBottom: "1px solid var(--color-borde)" }}
        >
          <div>
            <h2
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Vista previa del Excel
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Solo lectura — desliza para ver todas las columnas
            </p>
          </div>
          <AnimatePresence>
            {!cargando && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="chip chip-neutral"
              >
                {muestra.length} de {totalGestiones} filas
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {cargando ? (
              <motion.div
                key="cargando"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-auto"
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--color-borde)",
                }}
              >
                <table
                  className="text-xs border-collapse"
                  style={{ minWidth: "100%" }}
                >
                  <thead>
                    <tr>
                      <th
                        className="sticky left-0 px-2 py-2"
                        style={{
                          background: "var(--color-fondo-sutil)",
                          minWidth: "36px",
                        }}
                      />
                      {Array.from({ length: 6 }).map((_, i) => (
                        <th
                          key={i}
                          className="px-3 py-2"
                          style={{
                            background: "var(--color-fondo-sutil)",
                            minWidth: "140px",
                          }}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <FilaEsqueleto key={i} indice={i} />
                    ))}
                  </tbody>
                </table>
              </motion.div>
            ) : muestra.length === 0 ? (
              <motion.div
                key="vacio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <Table2
                  size={32}
                  style={{ color: "var(--color-texto-tenue)" }}
                  className="mb-3"
                />
                <p
                  className="text-sm"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Aún no hay gestiones registradas para mostrar en la vista
                  previa.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="datos"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-auto"
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--color-borde)",
                }}
              >
                <table
                  className="text-xs border-collapse"
                  style={{ minWidth: "100%" }}
                >
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th
                        className="sticky left-0 z-20 px-2 py-2 text-center font-medium"
                        style={{
                          background: "var(--color-accion)",
                          color: "white",
                          minWidth: "36px",
                          borderTopLeftRadius: "9px",
                        }}
                      >
                        #
                      </th>
                      {COLUMNAS.map((col, idx) => (
                        <th
                          key={col.clave}
                          className="px-3 py-2 text-left font-medium whitespace-nowrap"
                          style={{
                            background: "var(--color-accion)",
                            color: "white",
                            minWidth: "140px",
                            borderTopRightRadius:
                              idx === COLUMNAS.length - 1 ? "9px" : undefined,
                          }}
                        >
                          {col.etiqueta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {muestra.map((fila, i) => (
                      <tr
                        key={i}
                        style={{
                          background:
                            i % 2 === 0
                              ? "var(--color-superficie)"
                              : "var(--color-fondo-sutil)",
                        }}
                      >
                        <td
                          className="sticky left-0 px-2 py-1.5 text-center dato-numerico"
                          style={{
                            background:
                              i % 2 === 0
                                ? "var(--color-superficie)"
                                : "var(--color-fondo-sutil)",
                            color: "var(--color-texto-tenue)",
                            borderBottom: "1px solid var(--color-borde)",
                            borderRight: "1px solid var(--color-borde)",
                          }}
                        >
                          {i + 1}
                        </td>
                        {COLUMNAS.map((col) => (
                          <td
                            key={col.clave}
                            className="px-3 py-1.5 whitespace-nowrap dato-numerico"
                            style={{
                              borderBottom: "1px solid var(--color-borde)",
                              borderRight: "1px solid var(--color-borde)",
                            }}
                          >
                            {formatearCelda(fila[col.clave], col.clave)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {Array.from({ length: filasVaciasExtra }).map((_, i) => (
                      <tr
                        key={`vacia-${i}`}
                        style={{
                          background:
                            (muestra.length + i) % 2 === 0
                              ? "var(--color-superficie)"
                              : "var(--color-fondo-sutil)",
                        }}
                      >
                        <td
                          className="sticky left-0 px-2 py-1.5 text-center"
                          style={{
                            background:
                              (muestra.length + i) % 2 === 0
                                ? "var(--color-superficie)"
                                : "var(--color-fondo-sutil)",
                            color: "var(--color-texto-tenue)",
                            borderBottom: "1px solid var(--color-borde)",
                            borderRight: "1px solid var(--color-borde)",
                          }}
                        >
                          {muestra.length + i + 1}
                        </td>
                        {COLUMNAS.map((col) => (
                          <td
                            key={col.clave}
                            className="px-3 py-1.5"
                            style={{
                              borderBottom: "1px solid var(--color-borde)",
                              borderRight: "1px solid var(--color-borde)",
                            }}
                          >
                            &nbsp;
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
