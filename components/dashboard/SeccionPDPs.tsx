// components/dashboard/SeccionPDPs.tsx
// Orquesta la pestaña PDPs.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Pencil, Trash2 } from "lucide-react";
import GraficoPie from "./GraficoPie";
import TablaDinamica from "./TablaDinamica";
import SelectorRangoFecha, {
  rangoInicial,
  type RangoFecha,
} from "./SelectorRangoFecha";
import ModalEditarPromesa, { PromesaParaEditar } from "../ModalEditarPromesa";

type FilaFeed = {
  id: number;
  idc: string;
  fecha_hora: string;
  gestor: string;
  cliente: string | null;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  modalidad_pago: string | null;
  observacion: string | null;
  fecha_promesa: string;
  estado: string;
};

type FilaBusqueda = FilaFeed;

type DatosPDPs = {
  feed: FilaFeed[];
  vigentes: number;
  cumplidas: number;
  rotas: number;
  vencidas: number;
  porEstado: { clave: string; cantidad: number }[];
  porTipo: { clave: string; cantidad: number }[];
  detalle: Record<string, string | number | null>[];
  montoTotalPromesas: number;
};

const ETIQUETA_ESTADO: Record<string, string> = {
  vigente: "Vigente",
  cumplida: "Cumplida",
  rota: "Rota",
};

const COLOR_ESTADO: Record<string, string> = {
  Vigente: "var(--color-accion)",
  Cumplida: "#15803d",
  Rota: "#b91c1c",
};

const COLOR_ESTADO_CRUDO: Record<string, string> = {
  vigente: "var(--color-accion)",
  cumplida: "#15803d",
  rota: "#b91c1c",
};

const ETIQUETA_TIPO: Record<string, string> = {
  PAR: "Promesa de pago parcial",
  PCS: "Promesa de pago castigo en saldo",
  PDP: "Promesa de pago",
  PPC: "Promesa de pago de condonación",
};

const CAMPOS = [
  { clave: "fecha_hora", etiqueta: "Fecha y Hora" },
  { clave: "cliente", etiqueta: "Cliente" },
  { clave: "idc", etiqueta: "IDC" },
  { clave: "gestor", etiqueta: "Gestor" },
  { clave: "codcuentacobranza", etiqueta: "Cuenta de Cobranza" },
  { clave: "tipo", etiqueta: "Tipo de Promesa" },
  { clave: "moneda", etiqueta: "Moneda" },
  { clave: "modalidad_pago", etiqueta: "Modalidad de Pago" },
  { clave: "tipo_negociacion", etiqueta: "Tipo de Negociación" },
  { clave: "beneficio", etiqueta: "Beneficio" },
  { clave: "status_pdp", etiqueta: "Status PDP" },
  { clave: "status_pago", etiqueta: "Status Pago" },
  { clave: "estudio", etiqueta: "Estudio" },
  { clave: "matriz", etiqueta: "Matriz" },
  { clave: "estado", etiqueta: "Estado" },
  { clave: "vencida", etiqueta: "Vencida" },
  { clave: "fecha_promesa", etiqueta: "Fecha de Vencimiento" },
  { clave: "observacion", etiqueta: "Observación" },
];

const MEDIDAS = [
  {
    clave: "__conteo__",
    etiqueta: "Cantidad de promesas",
    agregacion: "suma" as const,
  },
  {
    clave: "monto_deuda_total",
    etiqueta: "Monto de la deuda (S/)",
    agregacion: "suma" as const,
  },
  {
    clave: "monto_prometido",
    etiqueta: "Monto prometido (S/)",
    agregacion: "suma" as const,
  },
  {
    clave: "monto_dolares",
    etiqueta: "Monto prometido ($, referencial)",
    agregacion: "suma" as const,
  },
  {
    clave: "numero_cuotas_aprobadas",
    etiqueta: "N° de cuotas aprobadas (promedio)",
    agregacion: "promedio" as const,
  },
];

function tiempoTranscurrido(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} d`;
}

function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatearMoneda(valor: number | null, moneda: string): string {
  if (valor == null) return "—";
  const simbolo = moneda === "Dolares" || moneda === "Dólares" ? "US$" : "S/";
  return `${simbolo} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TarjetaConteo({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="tarjeta p-4">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-1"
        style={{ color: "var(--color-texto-suave)" }}
      >
        {etiqueta}
      </p>
      <p className="text-2xl font-bold dato-numerico" style={{ color }}>
        {valor}
      </p>
    </div>
  );
}

function TarjetaMontoTotalPromesas({ monto }: { monto: number }) {
  return (
    <div className="tarjeta p-4 sm:p-5 flex flex-col justify-center">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-2"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Monto Total en Promesas
      </p>
      <p
        className="text-3xl font-bold dato-numerico"
        style={{ color: "var(--color-marca)" }}
      >
        {formatearMoneda(monto, "Soles")}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--color-texto-tenue)" }}>
        Suma de &quot;Monto Prometido&quot; de las promesas creadas en el
        periodo
      </p>
    </div>
  );
}

function FeedRecientePDPs({
  filas,
  rolPermitido,
  onEditar,
}: {
  filas: FilaFeed[];
  rolPermitido: boolean;
  onEditar: (f: FilaFeed) => void;
}) {
  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-4"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Actividad Reciente
      </p>

      {filas.length === 0 ? (
        <p
          className="text-sm py-6 text-center"
          style={{ color: "var(--color-texto-tenue)" }}
        >
          Aún no hay promesas de pago registradas.
        </p>
      ) : (
        <ul className="space-y-3">
          {filas.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {f.cliente ?? "—"}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  {f.gestor} · {tiempoTranscurrido(f.fecha_hora)}
                </p>
                {f.modalidad_pago && (
                  <p
                    className="text-xs truncate"
                    style={{ color: "var(--color-texto-tenue)" }}
                  >
                    {f.modalidad_pago}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: "var(--color-fondo-sutil)",
                    color:
                      COLOR_ESTADO_CRUDO[f.estado] ??
                      "var(--color-texto-suave)",
                  }}
                >
                  {f.tipo} · {ETIQUETA_ESTADO[f.estado] ?? f.estado}
                </span>
                {rolPermitido && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditar(f)}
                      className="p-1 rounded hover:bg-gray-100"
                      title="Editar"
                      style={{ color: "var(--color-texto-suave)" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onEditar(f)}
                      className="p-1 rounded hover:bg-gray-100"
                      title="Editar o eliminar"
                      style={{ color: "#b91c1c" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BuscadorPDPs({
  rolPermitido,
  onEditar,
}: {
  rolPermitido: boolean;
  onEditar: (r: FilaBusqueda) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<FilaBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscoAlgunaVez, setBuscoAlgunaVez] = useState(false);

  async function buscar(q: string) {
    setTexto(q);
    if (q.trim().length < 2) {
      setResultados([]);
      setBuscoAlgunaVez(false);
      return;
    }
    setBuscando(true);
    setBuscoAlgunaVez(true);
    const res = await fetch(
      `/api/admin/pdps-buscar?q=${encodeURIComponent(q)}`,
    );
    const data = await res.json();
    setResultados(data.resultados ?? []);
    setBuscando(false);
  }

  if (!rolPermitido) {
    return null;
  }

  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-3"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Buscar promesa de pago
      </p>

      <div className="relative mb-3">
        <Search
          size={15}
          className="absolute pointer-events-none"
          style={{
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-texto-tenue)",
          }}
        />
        <input
          type="text"
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Buscar por nombre de cliente o IDC..."
          className="w-full py-2 rounded text-sm"
          style={{
            border: "1px solid var(--color-borde-fuerte)",
            paddingLeft: 38,
            paddingRight: 12,
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {buscando && (
          <motion.p
            key="buscando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Buscando...
          </motion.p>
        )}

        {!buscando && buscoAlgunaVez && resultados.length === 0 && (
          <motion.p
            key="vacio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Sin resultados para &quot;{texto}&quot;.
          </motion.p>
        )}

        {!buscando && resultados.length > 0 && (
          <motion.div
            key="resultados"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 max-h-96 overflow-y-auto"
          >
            {resultados.map((r) => (
              <div
                key={r.id}
                className="border-l-2 pl-3 py-1.5"
                style={{
                  borderColor:
                    COLOR_ESTADO_CRUDO[r.estado] ?? "var(--color-borde)",
                }}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.cliente ?? "—"}
                    </p>
                    <p
                      className="text-xs dato-numerico"
                      style={{ color: "var(--color-texto-suave)" }}
                    >
                      IDC {r.idc} · {r.gestor}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-medium"
                      style={{
                        color:
                          COLOR_ESTADO_CRUDO[r.estado] ??
                          "var(--color-texto-suave)",
                      }}
                    >
                      {ETIQUETA_ESTADO[r.estado] ?? r.estado}
                    </span>
                    <button
                      onClick={() => onEditar(r)}
                      className="p-1 rounded hover:bg-gray-100"
                      title="Editar"
                      style={{ color: "var(--color-texto-suave)" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onEditar(r)}
                      className="p-1 rounded hover:bg-gray-100"
                      title="Editar o eliminar"
                      style={{ color: "#b91c1c" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  {r.tipo} · {formatearMoneda(r.monto_deuda_total, r.moneda)} ·
                  Vence: {formatearFechaCorta(r.fecha_promesa)}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SeccionPDPs() {
  const [rango, setRango] = useState<RangoFecha>(rangoInicial());
  const [datos, setDatos] = useState<DatosPDPs | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rolPermitido, setRolPermitido] = useState(false);
  const [promesaEditando, setPromesaEditando] =
    useState<PromesaParaEditar | null>(null);

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

  function cargarDatos() {
    setCargando(true);
    fetch(`/api/dashboard/pdps?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then((res) => res.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarDatos();
  }, [rango]);

  function abrirDesdeFeed(f: FilaFeed) {
    setPromesaEditando({
      id: f.id,
      cliente: f.cliente,
      gestor: f.gestor,
      tipo: f.tipo,
      moneda: f.moneda,
      monto_prometido: f.monto_prometido,
      modalidad_pago: f.modalidad_pago,
      observacion: f.observacion,
      fecha_promesa: f.fecha_promesa,
      estado: f.estado,
    });
  }

  function abrirDesdeBusqueda(r: FilaBusqueda) {
    setPromesaEditando({
      id: r.id,
      cliente: r.cliente,
      gestor: r.gestor,
      tipo: r.tipo,
      moneda: r.moneda,
      monto_prometido: r.monto_prometido,
      modalidad_pago: r.modalidad_pago,
      observacion: r.observacion,
      fecha_promesa: r.fecha_promesa,
      estado: r.estado,
    });
  }

  function alGuardar() {
    setPromesaEditando(null);
    cargarDatos();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <BuscadorPDPs
          rolPermitido={rolPermitido}
          onEditar={abrirDesdeBusqueda}
        />
        <div className="flex lg:justify-end">
          <SelectorRangoFecha valor={rango} onCambiar={setRango} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {cargando && (
          <motion.div
            key="cargando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="tarjeta p-8 text-center"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Cargando promesas de pago...
          </motion.div>
        )}

        {!cargando && !datos && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="tarjeta p-8 text-center"
            style={{ color: "var(--color-error)" }}
          >
            No se pudieron cargar las promesas de pago.
          </motion.div>
        )}

        {!cargando && datos && (
          <motion.div
            key="datos"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              <FeedRecientePDPs
                filas={datos.feed}
                rolPermitido={rolPermitido}
                onEditar={abrirDesdeFeed}
              />
              <TarjetaMontoTotalPromesas monto={datos.montoTotalPromesas} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              <TarjetaConteo
                etiqueta="Vigentes"
                valor={datos.vigentes}
                color="var(--color-accion)"
              />
              <TarjetaConteo
                etiqueta="Cumplidas"
                valor={datos.cumplidas}
                color="#15803d"
              />
              <TarjetaConteo
                etiqueta="Rotas"
                valor={datos.rotas}
                color="#b91c1c"
              />
              <TarjetaConteo
                etiqueta="Vencidas"
                valor={datos.vencidas}
                color="#d97706"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GraficoPie
                titulo="Promesas por Estado"
                datos={datos.porEstado.map((f) => ({
                  nombre: ETIQUETA_ESTADO[f.clave] ?? f.clave,
                  cantidad: f.cantidad,
                }))}
                colores={COLOR_ESTADO}
              />
              <GraficoPie
                titulo="Promesas por Tipo"
                datos={datos.porTipo.map((f) => ({
                  nombre: ETIQUETA_TIPO[f.clave] ?? f.clave,
                  cantidad: f.cantidad,
                }))}
              />
            </div>

            <TablaDinamica
              titulo="Tabla dinámica — PDPs"
              filas={datos.detalle}
              campos={CAMPOS}
              medidas={MEDIDAS}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ModalEditarPromesa
        promesa={promesaEditando}
        onCerrar={() => setPromesaEditando(null)}
        onGuardado={alGuardar}
      />
    </div>
  );
}
