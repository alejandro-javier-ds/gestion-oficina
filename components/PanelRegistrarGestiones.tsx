// components/PanelRegistrarGestiones.tsx

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, CreditCard } from "lucide-react";

import {
  RAZONES_TAT,
  RAZONES_MCT,
  RAZONES_TIN,
  OTRAS_GESTIONES,
  SEGMENTACIONES,
  OpcionCatalogo,
} from "@/lib/catalogo-tipificacion";

import { Cuenta } from "@/lib/types";
import ModalPromesaPago from "./ModalPromesaPago";

type Categoria = "TAT" | "MCT" | "TIN" | null;

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
};

type Promesa = {
  id: number;
  codcuentacobranza: string;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  modalidad_pago: string | null;
  observacion: string | null;
  fecha_promesa: string;
  estado: "vigente" | "cumplida" | "rota";
};

type Cita = {
  id: number;
  tipo: "CIH" | "CIT";
  fecha_cita: string;
  observacion: string | null;
  estado: string;
};

const CATALOGO_POR_CATEGORIA: Record<string, OpcionCatalogo[]> = {
  TAT: RAZONES_TAT,
  MCT: RAZONES_MCT,
  TIN: RAZONES_TIN,
};

const VERDE_ICONO = "#4BCA81";
const AZUL_TEXTO = "#0176D3";

const ESTILO_ESTADO: Record<string, { color: string; etiqueta: string }> = {
  vigente: { color: AZUL_TEXTO, etiqueta: "Vigente" },
  cumplida: { color: "#15803D", etiqueta: "Cumplida" },
  rota: { color: "#B91C1C", etiqueta: "Rota" },
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);

  if (isNaN(fecha.getTime())) {
    return iso;
  }

  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatearMoneda(valor: number | null, moneda: string): string {
  if (valor == null) return "—";

  const simbolo = moneda === "Dolares" || moneda === "Dólares" ? "US$" : "S/";

  return `${simbolo} ${valor.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function esCelularValido(phone: string): boolean {
  return /^9\d{8}$/.test(phone.replace(/\D/g, ""));
}

export default function PanelRegistrarGestiones({
  idc,
  cuentas,
  telefonos = [],
  onGestionGuardada,
}: {
  idc: string;
  cuentas: Cuenta[];
  telefonos?: Telefono[];
  onGestionGuardada?: () => void;
}) {
  const [seccionCitasAbierta, setSeccionCitasAbierta] = useState(false);
  const [seccionGestionesAbierta, setSeccionGestionesAbierta] = useState(true);

  const [mostrarFormCit, setMostrarFormCit] = useState(false);
  const [fechaCit, setFechaCit] = useState("");
  const [guardandoCita, setGuardandoCita] = useState<"CIH" | "CIT" | null>(
    null,
  );
  const [mensajeCita, setMensajeCita] = useState<string | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargandoCitas, setCargandoCitas] = useState(true);

  const [categoriaActiva, setCategoriaActiva] = useState<Categoria>(null);
  const [razonElegida, setRazonElegida] = useState("");
  const [otraGestionElegida, setOtraGestionElegida] = useState("");
  const [segmentacion, setSegmentacion] = useState("");
  const [telefonoElegido, setTelefonoElegido] = useState("");
  const [montoPagado, setMontoPagado] = useState("");
  const [monedaMontoPagado, setMonedaMontoPagado] = useState("Soles");
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [modalPromesaAbierto, setModalPromesaAbierto] = useState(false);
  const [guardandoPromesa, setGuardandoPromesa] = useState(false);
  const [mensajePromesa, setMensajePromesa] = useState<string | null>(null);
  const [promesas, setPromesas] = useState<Promesa[]>([]);
  const [cargandoPromesas, setCargandoPromesas] = useState(true);

  function cargarCitas() {
    setCargandoCitas(true);

    fetch(`/api/citas?idc=${encodeURIComponent(idc)}`)
      .then((res) => res.json())
      .then((data) => setCitas(data.citas ?? []))
      .finally(() => setCargandoCitas(false));
  }

  function cargarPromesas() {
    setCargandoPromesas(true);

    fetch(`/api/promesas?idc=${encodeURIComponent(idc)}`)
      .then((res) => res.json())
      .then((data) => setPromesas(data.promesas ?? []))
      .finally(() => setCargandoPromesas(false));
  }

  useEffect(() => {
    cargarCitas();
    cargarPromesas();
  }, [idc]);

  const telefonosValidos = telefonos.filter((t) => esCelularValido(t.phone));

  async function crearCita(tipo: "CIH" | "CIT") {
    if (tipo === "CIT" && !mostrarFormCit) {
      setMostrarFormCit(true);
      return;
    }

    if (tipo === "CIT" && !fechaCit) {
      setMensajeCita("Elige la fecha de la cita.");
      return;
    }

    setGuardandoCita(tipo);
    setMensajeCita(null);

    const res = await fetch("/api/citas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idc,
        tipo,
        fecha_cita: tipo === "CIT" ? fechaCit : undefined,
      }),
    });

    setGuardandoCita(null);

    if (res.ok) {
      setMostrarFormCit(false);
      setFechaCit("");
      cargarCitas();
      return;
    }

    const data = await res.json().catch(() => null);
    setMensajeCita(data?.error ?? "Ocurrió un error al crear la cita.");
  }

  async function guardar() {
    const categoria = categoriaActiva ?? "OTRAS";
    const codigo_razon = categoriaActiva ? razonElegida : otraGestionElegida;

    if (!codigo_razon) {
      setMensaje("Selecciona una razón antes de guardar.");
      return;
    }

    if (!segmentacion) {
      setMensaje("Selecciona una Segmentación antes de guardar.");
      return;
    }

    if (!telefonoElegido) {
      setMensaje("Selecciona el teléfono al que se llamó antes de guardar.");
      return;
    }

    const montoPagadoNumero =
      montoPagado.trim() === "" ? null : Number(montoPagado);

    if (
      montoPagadoNumero != null &&
      (isNaN(montoPagadoNumero) || montoPagadoNumero < 0)
    ) {
      setMensaje("El monto pagado debe ser un número válido.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const res = await fetch("/api/gestiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idc,
        categoria,
        codigo_razon,
        segmentacion,
        telefono: telefonoElegido,
        monto_pagado: montoPagadoNumero,
        moneda_monto_pagado: monedaMontoPagado,
        observacion,
      }),
    });

    setGuardando(false);

    if (res.ok) {
      setMensaje("Gestión guardada correctamente.");
      setCategoriaActiva(null);
      setRazonElegida("");
      setOtraGestionElegida("");
      setSegmentacion("");
      setTelefonoElegido("");
      setMontoPagado("");
      setMonedaMontoPagado("Soles");
      setObservacion("");
      onGestionGuardada?.();
      return;
    }

    if (res.status === 401) {
      setMensaje(
        "Tu sesión expiró. Recarga la página para volver a iniciar sesión.",
      );
      return;
    }

    if (res.status === 403) {
      setMensaje("No tienes acceso a este cliente.");
      return;
    }

    const data = await res.json().catch(() => null);

    setMensaje(data?.error ?? "Ocurrió un error al guardar.");
  }

  async function guardarPromesaDesdeModal(datos: {
    tipo: string;
    moneda: string;
    codcuentacobranza: string;
    fecha_promesa: string;
    monto_prometido: number | null;
    modalidad_pago: string;
    observacion: string;
    tipo_negociacion: string;
    beneficio: string;
    status_pdp: string;
    status_pago: string;
    numero_cuotas_aprobadas: number | null;
  }) {
    if (!datos.fecha_promesa) {
      setMensajePromesa("Indica la fecha de la promesa.");
      return;
    }

    setGuardandoPromesa(true);
    setMensajePromesa(null);

    const res = await fetch("/api/promesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idc,
        ...datos,
      }),
    });

    setGuardandoPromesa(false);

    if (res.ok) {
      setModalPromesaAbierto(false);
      cargarPromesas();
      onGestionGuardada?.();
      return;
    }

    const data = await res.json().catch(() => null);

    setMensajePromesa(data?.error ?? "Ocurrió un error al crear la promesa.");
  }

  async function cambiarEstadoPromesa(id: number, estado: "cumplida" | "rota") {
    const res = await fetch(`/api/promesas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });

    if (res.ok) {
      cargarPromesas();
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div
          className="flex items-center justify-between gap-3 p-3 sm:p-4"
          style={{
            borderBottom: "1px solid #E5E7EB",
            background: "#FBFBFB",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="rounded p-1.5 shrink-0"
              style={{ background: VERDE_ICONO }}
            >
              <CreditCard size={17} className="text-white" />
            </div>

            <h2 className="text-[15px] font-bold text-gray-900 truncate">
              Promesa de Pago
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setModalPromesaAbierto(true)}
            disabled={cuentas.length === 0}
            className="boton-secundario min-h-9 px-3 py-1.5 text-[13px] shrink-0"
            style={{
              color: AZUL_TEXTO,
              borderColor: "#D1D5DB",
            }}
          >
            Crear
          </button>
        </div>

        <div className="px-3 sm:px-4 pt-3 pb-1">
          <AnimatePresence mode="wait">
            {!cargandoPromesas && promesas.length === 0 && (
              <motion.p
                key="vacio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[13px] text-gray-500 pb-2"
              >
                Este cliente no tiene promesas de pago registradas.
              </motion.p>
            )}

            {!cargandoPromesas && promesas.length > 0 && (
              <motion.ul
                key="lista"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 pb-3"
              >
                {promesas.map((p, i) => {
                  const estilo = ESTILO_ESTADO[p.estado];

                  return (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(i * 0.03, 0.2),
                      }}
                      className="text-xs border-l-2 pl-2.5"
                      style={{
                        borderColor: estilo.color,
                      }}
                    >
                      <div className="flex flex-wrap justify-between gap-1">
                        <span className="font-medium text-gray-800">
                          {p.tipo} - Promesa de pago
                        </span>

                        <span
                          className="font-medium"
                          style={{
                            color: estilo.color,
                          }}
                        >
                          {estilo.etiqueta}
                        </span>
                      </div>

                      <p className="text-gray-500">
                        {formatearMoneda(p.monto_deuda_total, p.moneda)} · Venc:{" "}
                        {formatearFecha(p.fecha_promesa)}
                      </p>

                      {p.monto_prometido != null && (
                        <p className="text-gray-500">
                          Prometido:{" "}
                          {formatearMoneda(p.monto_prometido, p.moneda)}
                          {p.modalidad_pago && ` · ${p.modalidad_pago}`}
                        </p>
                      )}

                      {p.observacion && (
                        <p className="text-gray-600 mt-0.5 break-words">
                          {p.observacion}
                        </p>
                      )}

                      {p.estado === "vigente" && (
                        <div className="flex flex-wrap gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              cambiarEstadoPromesa(p.id, "cumplida")
                            }
                            className="text-xs font-medium hover:underline"
                            style={{
                              color: "#15803D",
                            }}
                          >
                            Marcar cumplida
                          </button>

                          <button
                            type="button"
                            onClick={() => cambiarEstadoPromesa(p.id, "rota")}
                            className="text-xs font-medium hover:underline"
                            style={{
                              color: "#B91C1C",
                            }}
                          >
                            Marcar rota
                          </button>
                        </div>
                      )}
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <div className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setSeccionCitasAbierta((v) => !v)}
            className="flex items-center min-h-10 text-[14px] text-gray-800 font-medium pb-3 mb-3 w-full text-left focus-visible:outline-none"
            style={{
              borderBottom: "1px solid #E5E7EB",
            }}
            aria-expanded={seccionCitasAbierta}
          >
            {seccionCitasAbierta ? (
              <ChevronDown size={16} className="mr-1.5 text-gray-500" />
            ) : (
              <ChevronRight size={16} className="mr-1.5 text-gray-500" />
            )}
            Citas {citas.length > 0 && `(${citas.length})`}
          </button>

          <AnimatePresence initial={false}>
            {seccionCitasAbierta && (
              <motion.div
                initial={{
                  opacity: 0,
                  height: 0,
                }}
                animate={{
                  opacity: 1,
                  height: "auto",
                }}
                exit={{
                  opacity: 0,
                  height: 0,
                }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pl-2 sm:pl-5 pb-3 space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => crearCita("CIH")}
                      disabled={guardandoCita !== null}
                      className="boton-secundario w-full min-h-10 text-[13px] px-3"
                      style={{
                        color: AZUL_TEXTO,
                        borderColor: "#D1D5DB",
                      }}
                    >
                      {guardandoCita === "CIH"
                        ? "Guardando..."
                        : "CIH - Genera cita para el mismo día"}
                    </button>

                    <button
                      type="button"
                      onClick={() => crearCita("CIT")}
                      disabled={guardandoCita !== null}
                      className="boton-secundario w-full min-h-10 text-[13px] px-3"
                      style={{
                        color: AZUL_TEXTO,
                        borderColor: "#D1D5DB",
                      }}
                    >
                      {guardandoCita === "CIT"
                        ? "Guardando..."
                        : "CIT - Genera cita para otro día"}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {mostrarFormCit && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          height: 0,
                        }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                        }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                          <div className="flex-1">
                            <label className="label-estandar">
                              Fecha de la cita
                            </label>

                            <input
                              type="date"
                              value={fechaCit}
                              onChange={(e) => setFechaCit(e.target.value)}
                              className="input-estandar"
                              style={{
                                colorScheme: "light",
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => crearCita("CIT")}
                            disabled={guardandoCita !== null}
                            className="boton-primario w-full sm:w-auto min-h-10"
                            style={{
                              background: AZUL_TEXTO,
                              borderColor: AZUL_TEXTO,
                            }}
                          >
                            {guardandoCita === "CIT"
                              ? "Guardando..."
                              : "Confirmar"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {mensajeCita && (
                    <p
                      className="text-[13px]"
                      style={{
                        color: "#B91C1C",
                      }}
                    >
                      {mensajeCita}
                    </p>
                  )}

                  {!cargandoCitas && citas.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {citas.map((c) => (
                        <li
                          key={c.id}
                          className="text-[13px] flex flex-wrap items-center gap-1.5 text-gray-700"
                        >
                          <span
                            className="font-medium"
                            style={{
                              color: AZUL_TEXTO,
                            }}
                          >
                            {c.tipo}
                          </span>
                          {formatearFecha(c.fecha_cita)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setSeccionGestionesAbierta((v) => !v)}
            className="flex items-center min-h-10 text-[14px] text-gray-800 font-medium mb-4 w-full text-left focus-visible:outline-none"
            aria-expanded={seccionGestionesAbierta}
          >
            {seccionGestionesAbierta ? (
              <ChevronDown size={16} className="mr-1.5 text-gray-500" />
            ) : (
              <ChevronRight size={16} className="mr-1.5 text-gray-500" />
            )}
            Registrar gestiones
          </button>

          <AnimatePresence initial={false}>
            {seccionGestionesAbierta && (
              <motion.div
                initial={{
                  opacity: 0,
                  height: 0,
                }}
                animate={{
                  opacity: 1,
                  height: "auto",
                }}
                exit={{
                  opacity: 0,
                  height: 0,
                }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pl-2 sm:pl-5 pb-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(["TAT", "MCT", "TIN"] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() =>
                          setCategoriaActiva(
                            cat === categoriaActiva ? null : cat,
                          )
                        }
                        className="w-full min-h-10 border rounded-md text-[13px] px-3 transition-colors focus-visible:outline-none"
                        style={{
                          borderColor:
                            categoriaActiva === cat ? AZUL_TEXTO : "#D1D5DB",
                          background:
                            categoriaActiva === cat ? AZUL_TEXTO : "white",
                          color: categoriaActiva === cat ? "white" : AZUL_TEXTO,
                        }}
                      >
                        {cat === "TAT" && "TAT - Tratamiento al titular"}

                        {cat === "MCT" && "MCT - Mensaje con terceros"}

                        {cat === "TIN" && "TIN - Teléfono inválido"}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence initial={false}>
                    {categoriaActiva && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          height: 0,
                        }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                        }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <label className="label-estandar">
                          Razón de no pago
                        </label>

                        <select
                          value={razonElegida}
                          onChange={(e) => setRazonElegida(e.target.value)}
                          className="select-estandar"
                        >
                          <option value="">-- Ninguno --</option>

                          {CATALOGO_POR_CATEGORIA[categoriaActiva].map((op) => (
                            <option
                              key={op.codigo}
                              value={`${op.codigo} - ${op.descripcion}`}
                            >
                              {op.codigo} - {op.descripcion}
                            </option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="label-estandar">Otras gestiones</label>

                    <select
                      value={otraGestionElegida}
                      onChange={(e) => {
                        setOtraGestionElegida(e.target.value);
                        setCategoriaActiva(null);
                      }}
                      className="select-estandar"
                    >
                      <option value="">-- Ninguno --</option>

                      {OTRAS_GESTIONES.map((op) => (
                        <option
                          key={op.codigo}
                          value={`${op.codigo} - ${op.descripcion}`}
                        >
                          {op.codigo} - {op.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-estandar">
                      <span
                        style={{
                          color: "#B91C1C",
                        }}
                      >
                        *
                      </span>{" "}
                      Segmentación
                    </label>

                    <select
                      value={segmentacion}
                      onChange={(e) => setSegmentacion(e.target.value)}
                      className="select-estandar"
                    >
                      <option value="">-- Selecciona --</option>

                      {SEGMENTACIONES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-estandar">
                      <span
                        style={{
                          color: "#B91C1C",
                        }}
                      >
                        *
                      </span>{" "}
                      Teléfono al que se llamó
                    </label>

                    <select
                      value={telefonoElegido}
                      onChange={(e) => setTelefonoElegido(e.target.value)}
                      className="select-estandar"
                      disabled={telefonosValidos.length === 0}
                    >
                      <option value="">-- Selecciona --</option>

                      {telefonosValidos.map((t) => (
                        <option key={t.id_phone} value={t.phone}>
                          {t.phone}
                        </option>
                      ))}
                    </select>

                    {telefonosValidos.length === 0 && (
                      <p
                        className="text-[11px] mt-1 leading-relaxed"
                        style={{
                          color: "#B91C1C",
                        }}
                      >
                        Este cliente no tiene un celular válido (9 dígitos,
                        empieza en 9) registrado — no vas a poder guardar la
                        gestión hasta que se agregue uno.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="label-estandar">
                      Monto Pagado — opcional
                    </label>

                    <div className="flex">
                      <button
                        type="button"
                        onClick={() =>
                          setMonedaMontoPagado((actual) =>
                            actual === "Soles" ? "Dolares" : "Soles",
                          )
                        }
                        className="shrink-0 min-h-10 border border-gray-300 border-r-0 rounded-l-md px-3 text-[12px] font-medium bg-gray-50 hover:bg-gray-100 transition-colors focus-visible:outline-none"
                        title="Cambiar moneda del monto pagado"
                      >
                        {monedaMontoPagado === "Dolares" ? "US$" : "S/"}
                      </button>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={montoPagado}
                        onChange={(e) => setMontoPagado(e.target.value)}
                        placeholder="0.00"
                        className="input-estandar rounded-l-none dato-numerico"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-estandar">Observación</label>

                    <textarea
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      rows={3}
                      className="textarea-estandar"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando}
                    className="boton-primario w-full min-h-10"
                    style={{
                      background: AZUL_TEXTO,
                      borderColor: AZUL_TEXTO,
                    }}
                  >
                    {guardando ? "Guardando..." : "Crear"}
                  </button>

                  {mensaje && (
                    <motion.p
                      initial={{
                        opacity: 0,
                      }}
                      animate={{
                        opacity: 1,
                      }}
                      className="text-[13px] text-gray-600"
                    >
                      {mensaje}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ModalPromesaPago
        abierto={modalPromesaAbierto}
        cuentas={cuentas}
        guardando={guardandoPromesa}
        mensaje={mensajePromesa}
        onCancelar={() => {
          setModalPromesaAbierto(false);
          setMensajePromesa(null);
        }}
        onContinuar={guardarPromesaDesdeModal}
      />
    </>
  );
}
