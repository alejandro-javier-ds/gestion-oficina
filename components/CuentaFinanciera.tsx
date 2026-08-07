// components/CuentaFinanciera.tsx
// Vista de cuenta financiera individual.

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Landmark, Send } from "lucide-react";
import ModalPromesaPago from "./ModalPromesaPago";
import { Cuenta } from "@/lib/types";

type Promesa = {
  id: number;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  modalidad_pago: string | null;
  observacion: string | null;
  fecha_promesa: string;
  estado: "vigente" | "cumplida" | "rota";
};

const AZUL_LINK = "#0176D3";
const VERDE_ICONO = "#4BCA81";

const ESTILO_ESTADO: Record<string, { color: string; etiqueta: string }> = {
  vigente: { color: AZUL_LINK, etiqueta: "Vigente" },
  cumplida: { color: "#15803D", etiqueta: "Cumplida" },
  rota: { color: "#B91C1C", etiqueta: "Rota" },
};

function formatearMoneda(valor: number | null, moneda?: string): string {
  if (valor == null) return "—";
  const simbolo = moneda === "Dolares" || moneda === "Dólares" ? "US$" : "PEN";
  return `${simbolo} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CuentaFinanciera({ cuenta }: { cuenta: Cuenta }) {
  const [promesas, setPromesas] = useState<Promesa[]>([]);
  const [cargandoPromesas, setCargandoPromesas] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function cargarPromesas() {
    setCargandoPromesas(true);
    fetch(
      `/api/promesas?codcuentacobranza=${encodeURIComponent(cuenta.codcuentacobranza)}`,
    )
      .then((res) => res.json())
      .then((data) => setPromesas(data.promesas ?? []))
      .finally(() => setCargandoPromesas(false));
  }

  useEffect(() => {
    cargarPromesas();
  }, [cuenta.codcuentacobranza]);

  async function guardarPromesa(datos: {
    tipo: string;
    moneda: string;
    codcuentacobranza: string;
    fecha_promesa: string;
    monto_prometido: number | null;
    modalidad_pago: string;
    observacion: string;
  }) {
    if (!datos.fecha_promesa) {
      setMensaje("Indica la fecha de la promesa.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const res = await fetch("/api/promesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idc: cuenta.idc, ...datos }),
    });

    setGuardando(false);

    if (res.ok) {
      setModalAbierto(false);
      cargarPromesas();
    } else {
      const data = await res.json().catch(() => null);
      setMensaje(data?.error ?? "Ocurrió un error al crear la promesa.");
    }
  }

  async function cambiarEstadoPromesa(id: number, estado: "cumplida" | "rota") {
    const res = await fetch(`/api/promesas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (res.ok) cargarPromesas();
  }

  const CAMPOS_INFO: { etiqueta: string; valor: string | number | null }[] = [
    { etiqueta: "Propietario principal", valor: cuenta.cliente },
    { etiqueta: "Nombre del producto", valor: cuenta.descproducto },
    { etiqueta: "Estado", valor: cuenta.estado_cartera },
    { etiqueta: "Moneda", valor: "Soles" },
    { etiqueta: "Etapa Procesal", valor: cuenta.etapa_procesal },
    { etiqueta: "Rango de Mora", valor: cuenta.rango_mora },
    { etiqueta: "Expediente", valor: cuenta.expediente },
    { etiqueta: "Funcionario", valor: cuenta.funcionario },
    { etiqueta: "Gestor", valor: cuenta.gestor },
    { etiqueta: "Deuda Total Posición", valor: cuenta.dtp },
    { etiqueta: "Dirección", valor: cuenta.direccion },
    { etiqueta: "Distrito", valor: cuenta.distrito },
    { etiqueta: "Departamento", valor: cuenta.departamento },
    { etiqueta: "Tipo de Juicio", valor: cuenta.tipo_juicio },
    { etiqueta: "N° Juicio", valor: cuenta.nro_juicio },
  ];

  return (
    <>
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div style={{ flex: "1 1 480px", minWidth: 0 }}>
            <div
              style={{
                background: "#F3F4F6",
                borderRadius: 6,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    background: VERDE_ICONO,
                    borderRadius: 4,
                    padding: 6,
                    display: "flex",
                  }}
                >
                  <Landmark size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                    Cuenta financiera
                  </p>
                  <p className="text-base font-bold text-gray-900 dato-numerico">
                    {cuenta.codcuentacobranza}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 16,
                  marginTop: 12,
                }}
              >
                <div>
                  <p className="text-[11px] text-gray-500">
                    Nombre del producto
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: AZUL_LINK }}
                  >
                    {cuenta.descproducto ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Deuda Vencida</p>
                  <p className="text-sm font-medium dato-numerico">
                    {formatearMoneda(cuenta.mtodeudavencida_sol)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Deuda Total</p>
                  <p className="text-sm font-medium dato-numerico">
                    {formatearMoneda(cuenta.mtodeuda_sol)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Días de Mora</p>
                  <p className="text-sm font-medium dato-numerico">
                    {cuenta.diasmora ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ border: "1px solid #E5E7EB", borderRadius: 6 }}>
              <div
                style={{
                  padding: 10,
                  background: "#F8F9FB",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <h3 className="text-sm font-bold text-gray-900">
                  Información de la cuenta
                </h3>
              </div>
              <div
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  columnGap: 32,
                  rowGap: 12,
                }}
              >
                {CAMPOS_INFO.map(({ etiqueta, valor }) => (
                  <div
                    key={etiqueta}
                    className="text-sm"
                    style={{ minWidth: 0 }}
                  >
                    <p className="text-xs text-gray-500">{etiqueta}</p>
                    <p
                      className="font-medium text-gray-900"
                      style={{ overflowWrap: "break-word" }}
                    >
                      {valor ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
              <p
                className="text-xs text-gray-400"
                style={{ padding: "0 16px 12px" }}
              >
                Datos de la deuda, Condiciones del crédito, Historial crediticio
                y Movimientos no están disponibles — esa información no viene en
                el portafolio del banco.
              </p>
            </div>
          </div>

          <div
            style={{
              flex: "0 1 320px",
              minWidth: 280,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="bg-white rounded border border-gray-200 shadow-sm">
              <div
                className="flex items-center justify-between p-3"
                style={{
                  borderBottom: "1px solid #E5E7EB",
                  background: "#FBFBFB",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="rounded p-1.5"
                    style={{ background: VERDE_ICONO }}
                  >
                    <Send size={14} className="text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Promesa de Pago
                  </h2>
                </div>
                <button
                  onClick={() => setModalAbierto(true)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 shadow-sm"
                  style={{ color: AZUL_LINK }}
                >
                  Crear
                </button>
              </div>

              <div className="px-3 py-2">
                {cargandoPromesas ? (
                  <p className="text-xs text-gray-500 py-2">Cargando...</p>
                ) : promesas.filter((p) => p.estado === "vigente").length ===
                  0 ? (
                  <p className="text-xs text-gray-500 py-2">
                    El producto no cuenta con promesas de pago vigentes.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded border border-gray-200 shadow-sm">
              <div
                className="px-3 py-2.5"
                style={{ borderBottom: "1px solid #E5E7EB" }}
              >
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  Promesas de Pago ({promesas.length})
                </h3>
              </div>

              <AnimatePresence mode="wait">
                {!cargandoPromesas && promesas.length === 0 && (
                  <motion.p
                    key="vacio"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-gray-500 p-3"
                  >
                    Sin promesas registradas para esta cuenta.
                  </motion.p>
                )}
                {!cargandoPromesas && promesas.length > 0 && (
                  <motion.ul
                    key="lista"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-3 space-y-2.5"
                  >
                    {promesas.map((p, i) => {
                      const estilo = ESTILO_ESTADO[p.estado];
                      return (
                        <motion.li
                          key={p.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="text-xs border-l-2 pl-2.5"
                          style={{ borderColor: estilo.color }}
                        >
                          <div className="flex justify-between items-baseline flex-wrap gap-1">
                            <span className="font-medium text-gray-800">
                              {p.tipo} - Promesa de pago
                            </span>
                            <span
                              className="font-medium"
                              style={{ color: estilo.color }}
                            >
                              {estilo.etiqueta}
                            </span>
                          </div>
                          <p className="text-gray-500">
                            {formatearMoneda(p.monto_deuda_total, p.moneda)} ·
                            Venc: {formatearFecha(p.fecha_promesa)}
                          </p>
                          {p.monto_prometido != null && (
                            <p className="text-gray-500">
                              Prometido:{" "}
                              {formatearMoneda(p.monto_prometido, p.moneda)}
                              {p.modalidad_pago && <> · {p.modalidad_pago}</>}
                            </p>
                          )}
                          {p.observacion && (
                            <p className="text-gray-600 mt-0.5">
                              {p.observacion}
                            </p>
                          )}
                          {p.estado === "vigente" && (
                            <div className="flex gap-3 mt-0.5">
                              <button
                                onClick={() =>
                                  cambiarEstadoPromesa(p.id, "cumplida")
                                }
                                className="font-medium"
                                style={{ color: "#15803D" }}
                              >
                                Marcar cumplida
                              </button>
                              <button
                                onClick={() =>
                                  cambiarEstadoPromesa(p.id, "rota")
                                }
                                className="font-medium"
                                style={{ color: "#B91C1C" }}
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
          </div>
        </div>
      </div>

      <ModalPromesaPago
        abierto={modalAbierto}
        cuentas={[cuenta]}
        guardando={guardando}
        mensaje={mensaje}
        onCancelar={() => {
          setModalAbierto(false);
          setMensaje(null);
        }}
        onContinuar={guardarPromesa}
      />
    </>
  );
}
