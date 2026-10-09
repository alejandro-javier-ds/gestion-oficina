// components/ModalPromesaPago.tsx
// Modal "Crear Promesa de Pago".

"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";

import {
  TIPOS_PROMESA_PAGO,
  MODALIDADES_PAGO,
  TIPOS_NEGOCIACION,
  BENEFICIOS,
  STATUS_PDP,
  STATUS_PAGO,
} from "@/lib/catalogo-tipificacion";

import { Cuenta } from "@/lib/types";

const AZUL_BOTON = "#2874CF";
const BORDE = "#D9DDE3";
const FONDO_INPUT = "#FAFAFB";
const TEXTO_SUAVE = "#6B7280";

type CuentaConMonedaOrigen = Cuenta & {
  codmoneda?: string | null;
  deudatotal_monedaorigen?: number | null;
  deudavencida_monedaorigen?: number | null;
  CODMONEDA?: string | null;
  DEUDATOTAL_MONEDAORIGEN?: number | null;
  DEUDAVENCIDA_MONEDAORIGEN?: number | null;
};

type Props = {
  abierto: boolean;
  cuentas: Cuenta[];
  guardando: boolean;
  mensaje: string | null;
  onCancelar: () => void;
  onContinuar: (datos: {
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
  }) => void;
};

function normalizarMoneda(
  valor: string | null | undefined,
): "Soles" | "Dolares" {
  const texto = String(valor ?? "")
    .trim()
    .toUpperCase();

  return texto.includes("DOLAR") || texto.includes("USD") || texto === "$"
    ? "Dolares"
    : "Soles";
}

function simboloMoneda(moneda: string): string {
  return normalizarMoneda(moneda) === "Dolares" ? "US$" : "S/";
}

function codigoMoneda(moneda: string): string {
  return normalizarMoneda(moneda) === "Dolares" ? "USD" : "PEN";
}

function obtenerMonedaCuenta(
  cuenta: CuentaConMonedaOrigen,
): "Soles" | "Dolares" {
  return normalizarMoneda(cuenta.codmoneda ?? cuenta.CODMONEDA);
}

function obtenerDeudaOrigen(cuenta: CuentaConMonedaOrigen): number | null {
  const valor =
    cuenta.deudatotal_monedaorigen ?? cuenta.DEUDATOTAL_MONEDAORIGEN;

  return valor != null ? Number(valor) : cuenta.mtodeuda_sol;
}

function obtenerDeudaVencidaOrigen(
  cuenta: CuentaConMonedaOrigen,
): number | null {
  const valor =
    cuenta.deudavencida_monedaorigen ?? cuenta.DEUDAVENCIDA_MONEDAORIGEN;

  return valor != null ? Number(valor) : cuenta.mtodeudavencida_sol;
}

function formatearNumero(valor: number | null): string {
  if (valor == null || Number.isNaN(Number(valor))) {
    return "—";
  }

  return Number(valor).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatearMontoCuenta(valor: number | null, moneda: string): string {
  if (valor == null) return "—";

  return `${simboloMoneda(moneda)} ${formatearNumero(valor)}`;
}

function formatearFecha(iso: string): string {
  if (!iso) return "—";

  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }

  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Label({
  children,
  obligatorio = false,
}: {
  children: ReactNode;
  obligatorio?: boolean;
}) {
  return (
    <label className="label-estandar">
      {children}
      {obligatorio && (
        <span className="ml-1" style={{ color: "#B42318" }}>
          *
        </span>
      )}
    </label>
  );
}

function SelectCampo({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-estandar"
      >
        {children}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "#667085" }}
      />
    </div>
  );
}

export default function ModalPromesaPago({
  abierto,
  cuentas,
  guardando,
  mensaje,
  onCancelar,
  onContinuar,
}: Props) {
  const [tipo, setTipo] = useState("PDP");
  const [moneda, setMoneda] = useState("Soles");
  const [filaElegida, setFilaElegida] = useState(0);
  const [fecha, setFecha] = useState("");
  const [montoPrometido, setMontoPrometido] = useState("");
  const [modalidadPago, setModalidadPago] = useState("");
  const [observacion, setObservacion] = useState("");
  const [tipoNegociacion, setTipoNegociacion] = useState("");
  const [beneficio, setBeneficio] = useState("");
  const [statusPdp, setStatusPdp] = useState("");
  const [statusPago, setStatusPago] = useState("");
  const [numeroCuotas, setNumeroCuotas] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const cuentasConMoneda = cuentas as CuentaConMonedaOrigen[];

  const cuentaElegida = cuentasConMoneda[filaElegida];

  const monedaPromesa = normalizarMoneda(moneda);
  const simboloPromesa = simboloMoneda(moneda);
  const codigoPromesa = codigoMoneda(moneda);

  const resumenCuentaElegida = useMemo(() => {
    if (!cuentaElegida) return null;

    return {
      moneda: obtenerMonedaCuenta(cuentaElegida),
      deuda: obtenerDeudaOrigen(cuentaElegida),
      deudaVencida: obtenerDeudaVencidaOrigen(cuentaElegida),
    };
  }, [cuentaElegida]);

  useEffect(() => {
    if (!abierto) return;
    setErrorLocal(null);
  }, [abierto]);

  useEffect(() => {
    if (filaElegida >= cuentasConMoneda.length) {
      setFilaElegida(0);
    }
  }, [cuentasConMoneda.length, filaElegida]);

  function manejarCambioMoneda(nuevaMoneda: string) {
    setMoneda(nuevaMoneda);
    setErrorLocal(null);
  }

  function manejarContinuar() {
    setErrorLocal(null);

    const montoNumero =
      montoPrometido.trim() === "" ? null : Number(montoPrometido);

    if (montoNumero != null && (Number.isNaN(montoNumero) || montoNumero < 0)) {
      setErrorLocal("El monto prometido debe ser un número válido.");
      return;
    }

    const cuotasNumero =
      numeroCuotas.trim() === "" ? null : Number(numeroCuotas);

    if (
      cuotasNumero != null &&
      (Number.isNaN(cuotasNumero) || cuotasNumero < 0)
    ) {
      setErrorLocal("El número de cuotas debe ser un número válido.");
      return;
    }

    if (!cuentaElegida) {
      setErrorLocal("Selecciona una cuenta para crear la promesa.");
      return;
    }

    if (!fecha) {
      setErrorLocal("Indica la fecha de la promesa.");
      return;
    }

    onContinuar({
      tipo,
      moneda: monedaPromesa,
      codcuentacobranza: cuentaElegida.codcuentacobranza,
      fecha_promesa: fecha,
      monto_prometido: montoNumero,
      modalidad_pago: modalidadPago,
      observacion,
      tipo_negociacion: tipoNegociacion,
      beneficio,
      status_pdp: statusPdp,
      status_pago: statusPago,
      numero_cuotas_aprobadas: cuotasNumero,
    });
  }

  if (!abierto) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-2 sm:p-5"
        style={{
          background: "rgba(15, 23, 42, 0.56)",
        }}
        onClick={onCancelar}
      >
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.985,
            y: 8,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.985,
            y: 8,
          }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-[1080px] overflow-hidden rounded-lg sm:rounded-xl shadow-2xl flex flex-col"
          style={{
            maxHeight: "calc(100vh - 16px)",
          }}
        >
          <div
            className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 shrink-0"
            style={{
              borderBottom: `1px solid ${BORDE}`,
            }}
          >
            <div className="min-w-0">
              <p
                className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: AZUL_BOTON }}
              >
                Gestión de cobranza
              </p>

              <h1 className="text-[18px] sm:text-[20px] font-semibold text-slate-800 mt-0.5 truncate">
                Crear Promesa de Pago
              </h1>
            </div>

            <button
              type="button"
              onClick={onCancelar}
              className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors focus-visible:outline-none"
              style={{ color: "#667085" }}
              aria-label="Cerrar"
            >
              <X size={19} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <section>
              <div className="mb-4">
                <h2 className="text-[15px] font-semibold text-slate-800">
                  Selección de promesa
                </h2>

                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: TEXTO_SUAVE }}
                >
                  Define el tipo de promesa y la moneda en la que se registrará
                  el compromiso.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Promesa de pago</Label>

                  <SelectCampo value={tipo} onChange={setTipo}>
                    {TIPOS_PROMESA_PAGO.map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {t.codigo} - {t.descripcion}
                      </option>
                    ))}
                  </SelectCampo>
                </div>

                <div>
                  <Label>Moneda de la promesa</Label>

                  <SelectCampo value={moneda} onChange={manejarCambioMoneda}>
                    <option value="Soles">Soles (PEN)</option>
                    <option value="Dolares">Dólares (USD)</option>
                  </SelectCampo>
                </div>
              </div>
            </section>

            <div
              className="my-5 sm:my-6"
              style={{
                borderTop: "1px solid #EEF0F3",
              }}
            />

            <section>
              <div className="mb-4">
                <h2 className="text-[15px] font-semibold text-slate-800">
                  Selección de producto
                </h2>

                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: TEXTO_SUAVE }}
                >
                  Selecciona la cuenta sobre la que se registrará esta promesa.
                </p>

                {cuentaElegida && (
                  <div
                    className="mt-2 inline-flex sm:hidden items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium max-w-full"
                    style={{
                      background: "#EFF6FF",
                      color: "#2457A6",
                    }}
                  >
                    <span>Cuenta:</span>
                    <span className="dato-numerico truncate">
                      {cuentaElegida.codcuentacobranza}
                    </span>
                  </div>
                )}

                {cuentaElegida && (
                  <div
                    className="hidden sm:inline-flex mt-2 items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium"
                    style={{
                      background: "#EFF6FF",
                      color: "#2457A6",
                    }}
                  >
                    <span>Cuenta seleccionada:</span>
                    <span className="dato-numerico">
                      {cuentaElegida.codcuentacobranza}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="rounded-lg overflow-hidden"
                style={{
                  border: `1px solid ${BORDE}`,
                }}
              >
                <div className="tabla-scroll">
                  <table
                    className="w-full text-left"
                    style={{
                      minWidth: "760px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#F7F8FA",
                          borderBottom: `1px solid ${BORDE}`,
                        }}
                      >
                        <th className="py-3 px-3 w-12" />

                        <th
                          className="py-3 px-3 text-[11px] uppercase tracking-wide font-semibold whitespace-nowrap"
                          style={{ color: "#667085" }}
                        >
                          Cuenta
                        </th>

                        <th
                          className="py-3 px-3 text-[11px] uppercase tracking-wide font-semibold whitespace-nowrap"
                          style={{ color: "#667085" }}
                        >
                          Producto
                        </th>

                        <th
                          className="py-3 px-3 text-[11px] uppercase tracking-wide font-semibold text-right whitespace-nowrap"
                          style={{ color: "#667085" }}
                        >
                          Deuda total
                        </th>

                        <th
                          className="py-3 px-3 text-[11px] uppercase tracking-wide font-semibold text-right whitespace-nowrap"
                          style={{ color: "#667085" }}
                        >
                          Deuda vencida
                        </th>

                        <th
                          className="py-3 px-3 text-[11px] uppercase tracking-wide font-semibold text-right whitespace-nowrap"
                          style={{ color: "#667085" }}
                        >
                          Mora
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {cuentasConMoneda.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-10 text-center text-[13px]"
                            style={{
                              color: TEXTO_SUAVE,
                            }}
                          >
                            No hay cuentas disponibles para registrar la
                            promesa.
                          </td>
                        </tr>
                      ) : (
                        cuentasConMoneda.map((c, i) => {
                          const elegida = i === filaElegida;

                          const monedaCuenta = obtenerMonedaCuenta(c);

                          const deuda = obtenerDeudaOrigen(c);

                          const deudaVencida = obtenerDeudaVencidaOrigen(c);

                          return (
                            <tr
                              key={c.codcuentacobranza}
                              onClick={() => setFilaElegida(i)}
                              className="cursor-pointer transition-colors hover:bg-[var(--color-superficie-hover)]"
                              style={{
                                background: elegida ? "#F8FBFF" : "#FFFFFF",
                                borderBottom:
                                  i === cuentasConMoneda.length - 1
                                    ? undefined
                                    : "1px solid #EEF0F3",
                              }}
                            >
                              <td className="py-3.5 px-3 align-middle">
                                <input
                                  type="radio"
                                  name="cuenta-promesa-modal"
                                  checked={elegida}
                                  onChange={() => setFilaElegida(i)}
                                  className="radio-estandar"
                                />
                              </td>

                              <td className="py-3.5 px-3 align-middle">
                                <div className="dato-numerico text-[13px] font-medium text-slate-700 whitespace-nowrap">
                                  {c.codcuentacobranza}
                                </div>

                                <div
                                  className="mt-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                  style={{
                                    background:
                                      monedaCuenta === "Dolares"
                                        ? "#F3F0FF"
                                        : "#EEF7F1",
                                    color:
                                      monedaCuenta === "Dolares"
                                        ? "#6045A5"
                                        : "#2C6B46",
                                  }}
                                >
                                  {codigoMoneda(monedaCuenta)}
                                </div>
                              </td>

                              <td className="py-3.5 px-3 align-middle text-[13px] text-slate-700 whitespace-nowrap">
                                {c.descproducto ?? "—"}
                              </td>

                              <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                                <span className="dato-numerico text-[13px] font-medium text-slate-700">
                                  {formatearMontoCuenta(deuda, monedaCuenta)}
                                </span>
                              </td>

                              <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                                <span className="dato-numerico text-[13px] text-slate-600">
                                  {formatearMontoCuenta(
                                    deudaVencida,
                                    monedaCuenta,
                                  )}
                                </span>
                              </td>

                              <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                                <span className="dato-numerico text-[13px] text-slate-600">
                                  {c.diasmora ?? 0}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div
              className="my-5 sm:my-6"
              style={{
                borderTop: "1px solid #EEF0F3",
              }}
            />

            <section>
              <div className="mb-4">
                <h2 className="text-[15px] font-semibold text-slate-800">
                  Detalle de la promesa
                </h2>

                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: TEXTO_SUAVE }}
                >
                  Registra las condiciones concretas del compromiso.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Monto prometido</Label>

                  <div
                    className="flex items-center rounded-lg overflow-hidden"
                    style={{
                      border: `1px solid ${BORDE}`,
                      background: FONDO_INPUT,
                    }}
                  >
                    <div
                      className="min-h-[42px] min-w-[58px] px-3 flex items-center justify-center text-[13px] font-semibold shrink-0"
                      style={{
                        borderRight: `1px solid ${BORDE}`,
                        color: AZUL_BOTON,
                        background: "#F3F7FC",
                      }}
                    >
                      {simboloPromesa}
                    </div>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoPrometido}
                      onChange={(e) => setMontoPrometido(e.target.value)}
                      placeholder="Ej. 500.00"
                      className="min-w-0 flex-1 min-h-[42px] px-3 text-[14px] text-slate-800 outline-none bg-transparent dato-numerico"
                    />
                  </div>

                  <p
                    className="text-[11px] mt-1.5"
                    style={{ color: TEXTO_SUAVE }}
                  >
                    Ingreso en{" "}
                    {monedaPromesa === "Dolares"
                      ? "dólares estadounidenses (USD)"
                      : "soles peruanos (PEN)"}
                    .
                  </p>
                </div>

                <div>
                  <Label>Modalidad de pago</Label>

                  <SelectCampo
                    value={modalidadPago}
                    onChange={setModalidadPago}
                  >
                    <option value="">-- Ninguna --</option>

                    {MODALIDADES_PAGO.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.codigo} - {m.descripcion}
                      </option>
                    ))}
                  </SelectCampo>
                </div>

                <div>
                  <Label obligatorio>Fecha de la promesa</Label>

                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="input-estandar"
                    style={{
                      colorScheme: "light",
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div>
                  <Label>Tipo de negociación</Label>

                  <SelectCampo
                    value={tipoNegociacion}
                    onChange={setTipoNegociacion}
                  >
                    <option value="">-- Ninguna --</option>

                    {TIPOS_NEGOCIACION.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </SelectCampo>
                </div>

                <div>
                  <Label>Beneficio</Label>

                  <SelectCampo value={beneficio} onChange={setBeneficio}>
                    <option value="">-- Ninguno --</option>

                    {BENEFICIOS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </SelectCampo>
                </div>

                <div>
                  <Label>Status Pago</Label>

                  <SelectCampo value={statusPago} onChange={setStatusPago}>
                    <option value="">-- Ninguno --</option>

                    {STATUS_PAGO.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SelectCampo>
                </div>

                <div>
                  <Label>Status PDP</Label>

                  <SelectCampo value={statusPdp} onChange={setStatusPdp}>
                    <option value="">-- Ninguno --</option>

                    {STATUS_PDP.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SelectCampo>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 mt-4">
                <div>
                  <Label>N° de cuotas aprobadas</Label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={numeroCuotas}
                    onChange={(e) => setNumeroCuotas(e.target.value)}
                    placeholder="Ej. 12"
                    className="input-estandar dato-numerico"
                  />
                </div>

                <div>
                  <Label>Observación</Label>

                  <textarea
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    rows={3}
                    placeholder="Detalle libre sobre esta promesa..."
                    className="textarea-estandar"
                  />
                </div>
              </div>

              {resumenCuentaElegida && (
                <div
                  className="mt-4 rounded-lg px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E6EAF0",
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-[11px] uppercase tracking-wide font-semibold"
                      style={{
                        color: TEXTO_SUAVE,
                      }}
                    >
                      Resumen de cuenta seleccionada
                    </p>

                    <p className="text-[13px] text-slate-700 mt-0.5 break-words">
                      Deuda original:{" "}
                      <strong>
                        {formatearMontoCuenta(
                          resumenCuentaElegida.deuda,
                          resumenCuentaElegida.moneda,
                        )}
                      </strong>
                      {" · "}
                      Vencida:{" "}
                      <strong>
                        {formatearMontoCuenta(
                          resumenCuentaElegida.deudaVencida,
                          resumenCuentaElegida.moneda,
                        )}
                      </strong>
                    </p>
                  </div>

                  <span
                    className="self-start sm:self-auto shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{
                      background: "#EEF6FF",
                      color: "#2457A6",
                    }}
                  >
                    Promesa en {codigoPromesa}
                  </span>
                </div>
              )}

              {(errorLocal || mensaje) && (
                <div
                  className="mt-4 rounded-lg px-3.5 py-2.5 text-[13px]"
                  style={{
                    color: "#B42318",
                    background: "#FEF3F2",
                    border: "1px solid #FECACA",
                  }}
                >
                  {errorLocal ?? mensaje}
                </div>
              )}
            </section>
          </div>

          {/* Footer */}

          <div
            className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col-reverse sm:flex-row sm:items-center gap-2 shrink-0"
            style={{
              borderTop: `1px solid ${BORDE}`,
              background: "#FCFCFD",
            }}
          >
            <div
              className="hidden sm:block text-[12px] truncate"
              style={{ color: TEXTO_SUAVE }}
            >
              {cuentaElegida
                ? `Cuenta ${cuentaElegida.codcuentacobranza}`
                : "Sin cuenta seleccionada"}
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={onCancelar}
                className="boton-secundario flex-1 sm:flex-none min-h-10 px-5"
                style={{
                  color: "#475467",
                  borderColor: BORDE,
                  background: "#FFFFFF",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={manejarContinuar}
                disabled={guardando || !cuentaElegida}
                className="boton-primario flex-1 sm:flex-none min-h-10 px-6"
                style={{
                  background: AZUL_BOTON,
                  borderColor: AZUL_BOTON,
                }}
              >
                {guardando ? "Guardando..." : "Continuar"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
