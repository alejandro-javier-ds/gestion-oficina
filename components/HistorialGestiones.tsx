// components/HistorialGestiones.tsx
// Historial de gestiones con barra de filtros. Editar/Eliminar ahora
// abre ModalEditarGestion en vez del formulario
// inline que tenía antes — mismo patrón usado en PDPs.

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import ModalEditarGestion, { GestionParaEditar } from "./ModalEditarGestion";

type Gestion = {
  id: number;
  idc: string;
  codcuentacobranza: string | null;
  usuario_gestor_oficina: string;
  categoria: string | null;
  codigo_razon: string | null;
  fecha_hora: string;
  monto_compromiso: number | null;
  monto_pagado: number | null;
  fecha_promesa: string | null;
  observacion: string | null;
};

type Orden = "recientes" | "antiguas";

type FiltrosAplicados = {
  categoria: string;
  desde: string;
  hasta: string;
  orden: Orden;
};

const CHIP_POR_CATEGORIA: Record<string, string> = {
  TAT: "chip-exito",
  MCT: "chip-accion",
  TIN: "chip-alerta",
  PDP: "chip-accion",
  OTRAS: "chip-neutral",
};

const OPCIONES_CATEGORIA = [
  { valor: "TODAS", etiqueta: "Todas las gestiones" },
  { valor: "TAT", etiqueta: "TAT - Tratamiento al titular" },
  { valor: "MCT", etiqueta: "MCT - Mensaje con terceros" },
  { valor: "TIN", etiqueta: "TIN - Teléfono inválido" },
  { valor: "OTRAS", etiqueta: "Otras gestiones" },
  { valor: "PDP", etiqueta: "Promesa de pago" },
];

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

function ItemGestion({
  g,
  puedeEditar,
  onEditar,
}: {
  g: Gestion;
  puedeEditar: boolean;
  onEditar: (g: Gestion) => void;
}) {
  return (
    <li
      className="border-l-2 pl-3 py-1"
      style={{ borderColor: "var(--color-accion)" }}
    >
      <div className="flex justify-between items-baseline flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {g.categoria && (
            <span
              className={`chip ${CHIP_POR_CATEGORIA[g.categoria] ?? "chip-neutral"}`}
            >
              {g.categoria}
            </span>
          )}
          <span className="text-sm font-medium">{g.codigo_razon}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs"
            style={{ color: "var(--color-texto-suave)" }}
          >
            {formatearFecha(g.fecha_hora)}
          </span>
          {puedeEditar && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEditar(g)}
                className="p-1 rounded hover:bg-gray-100"
                title="Editar"
                style={{ color: "var(--color-texto-suave)" }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onEditar(g)}
                className="p-1 rounded hover:bg-gray-100"
                title="Editar o eliminar"
                style={{ color: "#b91c1c" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      <p
        className="text-xs mt-0.5"
        style={{ color: "var(--color-texto-suave)" }}
      >
        {g.usuario_gestor_oficina}
        {g.codcuentacobranza && (
          <>
            {" "}
            · Cuenta:{" "}
            <span className="dato-numerico">{g.codcuentacobranza}</span>
          </>
        )}
      </p>
      {g.observacion && <p className="text-sm mt-1">{g.observacion}</p>}
    </li>
  );
}

export default function HistorialGestiones({
  idc,
  refrescarSenal,
  rol,
}: {
  idc: string;
  refrescarSenal: number;
  rol?: string | null;
}) {
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState(false);
  const [gestionEditando, setGestionEditando] =
    useState<GestionParaEditar | null>(null);

  const [categoria, setCategoria] = useState("TODAS");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosAplicados>({
    categoria: "TODAS",
    desde: "",
    hasta: "",
    orden: "recientes",
  });

  const puedeEditar = rol === "supervisor" || rol === "administrador";

  function cargar() {
    setCargando(true);
    const params = new URLSearchParams({ idc });
    if (filtrosAplicados.categoria !== "TODAS")
      params.set("categoria", filtrosAplicados.categoria);
    if (filtrosAplicados.desde) params.set("desde", filtrosAplicados.desde);
    if (filtrosAplicados.hasta) params.set("hasta", filtrosAplicados.hasta);
    params.set(
      "orden",
      filtrosAplicados.orden === "antiguas" ? "antiguas" : "recientes",
    );

    fetch(`/api/gestiones?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setGestiones(data.gestiones ?? []))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, [idc, refrescarSenal, filtrosAplicados]);

  function aplicarFiltros() {
    setExpandido(false);
    setFiltrosAplicados({ categoria, desde, hasta, orden });
  }

  function abrirEdicion(g: Gestion) {
    setGestionEditando({
      id: g.id,
      cliente: null,
      usuario_gestor_oficina: g.usuario_gestor_oficina,
      categoria: g.categoria,
      codigo_razon: g.codigo_razon,
      fecha_hora: g.fecha_hora,
      monto_pagado: g.monto_pagado,
      observacion: g.observacion,
    });
  }

  function alGuardar() {
    setGestionEditando(null);
    cargar();
  }

  const [ultima, ...resto] = gestiones;

  return (
    <div className="border border-gray-200 rounded p-4">
      <div
        className="flex flex-wrap items-end gap-3 mb-4 pb-4"
        style={{ borderBottom: "1px solid #E5E7EB" }}
      >
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs block mb-1">
            <span style={{ color: "#B91C1C" }}>*</span> Filtrar por gestión
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
          >
            {OPCIONES_CATEGORIA.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className="text-xs block mb-1 text-gray-600">Desde:</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
            style={{ colorScheme: "light" }}
          />
        </div>

        <div className="min-w-[130px]">
          <label className="text-xs block mb-1 text-gray-600">Hasta:</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
            style={{ colorScheme: "light" }}
          />
        </div>

        <div className="min-w-[140px]">
          <label className="text-xs block mb-1 text-gray-600">
            Ordenar por:
          </label>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguas">Más antiguas</option>
          </select>
        </div>

        <button
          onClick={aplicarFiltros}
          className="text-sm font-medium px-4 py-1.5 rounded text-white"
          style={{ background: "var(--color-accion)" }}
        >
          Filtrar
        </button>
      </div>

      <div className="flex justify-between items-center mb-3 gap-2">
        <h2 className="font-semibold" style={{ color: "var(--color-texto)" }}>
          Historial de Gestiones{" "}
          {gestiones.length > 0 && `(${gestiones.length})`}
        </h2>
        {resto.length > 0 && (
          <button
            onClick={() => setExpandido((e) => !e)}
            className="flex items-center gap-1 text-xs font-medium shrink-0"
            style={{ color: "var(--color-accion)" }}
          >
            {expandido ? "Ver menos" : `Ver todo (${gestiones.length})`}
            {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

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
            Cargando historial...
          </motion.p>
        )}

        {!cargando && gestiones.length === 0 && (
          <motion.p
            key="vacio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Sin gestiones registradas todavía para este cliente.
          </motion.p>
        )}

        {!cargando && ultima && (
          <motion.ul
            key="lista"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <ItemGestion
              g={ultima}
              puedeEditar={puedeEditar}
              onEditar={abrirEdicion}
            />
            <AnimatePresence>
              {expandido &&
                resto.map((g, i) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.02 }}
                    className="overflow-hidden"
                  >
                    <ItemGestion
                      g={g}
                      puedeEditar={puedeEditar}
                      onEditar={abrirEdicion}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>

      <ModalEditarGestion
        gestion={gestionEditando}
        onCerrar={() => setGestionEditando(null)}
        onGuardado={alGuardar}
      />
    </div>
  );
}
