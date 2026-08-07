// components/PanelResumenCliente.tsx
// Panel de consulta rápida para el admin.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Wallet,
  Landmark,
  AlarmClock,
  Phone,
  History,
  Target,
  Clock,
  Smartphone,
  PhoneCall,
  ShieldCheck,
  HandCoins,
  CalendarClock,
  MapPin,
  Route,
  Scale,
} from "lucide-react";
import TarjetaEstadistica from "@/components/TarjetaEstadistica";

type Cuenta = {
  codcuentacobranza: string;
  mtodeuda_sol: number | null;
  diasmora: number | null;
};

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
  creado_por: string | null;
  editado_por: string | null;
  fecha_modificacion: string | null;
  agregado_manualmente: number;
};

type Garantia = {
  gar_codigo: string;
  tipo_garantia: string | null;
  descripcion: string | null;
  monto_realizacion: number | null;
};

type Promesa = {
  id: number;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  fecha_promesa: string;
  estado: "vigente" | "cumplida" | "rota";
};

type Cita = {
  id: number;
  tipo: string;
  fecha_cita: string;
  estado: string;
};

type Direccion = {
  id: number;
  direccion: string;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  tipo: string;
  fuente: string;
  fecha_modificacion: string;
};

type HistorialRouterItem = {
  id: number;
  fecha_registro: string;
  seguimiento: string;
  router: string;
  descripcion: string | null;
};

type ResumenCliente = {
  cliente: string;
  idc: string;
  segmentacion: string | null;
  expediente: string | null;
  tipoJuicio: string | null;
  nroJuicio: string | null;
  fecDemanda: string | null;
  supervisorProcesal: string | null;
  analistaProcesal: string | null;
  cantidadCuentas: number;
  deudaTotal: number;
  moraPromedio: number;
  cantidadTelefonos: number;
  gestionesHistoricas: number;
  contactabilidadPorcentaje: number;
  ultimaGestionFecha: string | null;
  cuentas: Cuenta[];
  telefonos: Telefono[];
  garantias: Garantia[];
  promesas: Promesa[];
  citas: Cita[];
  direcciones: Direccion[];
  historialRouter: HistorialRouterItem[];
};

function formatearMoneda(valor: number, moneda?: string): string {
  const simbolo = moneda === "Dolares" || moneda === "Dólares" ? "US$" : "S/";
  return `${simbolo} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatearFecha(iso: string | null): string {
  if (!iso) return "Sin gestiones registradas";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return String(iso);
  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function chipPorSegmentacion(segmentacion: string): string {
  const texto = segmentacion.toUpperCase();
  if (texto.includes("CONTACTO CON NEGOCIACION") || texto === "ACUERDO DE PAGO")
    return "chip-exito";
  if (
    texto.includes("NO CONTACTO") ||
    texto === "RENUENTE" ||
    texto === "FALLECIDO"
  )
    return "chip-alerta";
  return "chip-neutral";
}

const ESTILO_ESTADO_PROMESA: Record<
  string,
  { color: string; etiqueta: string }
> = {
  vigente: { color: "var(--color-accion)", etiqueta: "Vigente" },
  cumplida: { color: "var(--color-exito)", etiqueta: "Cumplida" },
  rota: { color: "var(--color-error, #b91c1c)", etiqueta: "Rota" },
};

const contenedorVariants: Variants = {
  oculto: { height: 0, opacity: 0 },
  visible: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  salida: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

const tarjetaVariants: Variants = {
  oculto: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.25 },
  }),
};

const listaInternaVariants: Variants = {
  oculto: { height: 0, opacity: 0 },
  visible: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

const COLOR_MARCA = "var(--color-marca)";

function TarjetaExpandible({
  etiqueta,
  valor,
  icono: Icono,
  expandido,
  onClick,
  children,
}: {
  etiqueta: string;
  valor: string | number;
  icono: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  expandido: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      className="rounded border overflow-hidden flex shadow-sm"
      style={{
        borderColor: expandido ? "var(--color-accion)" : "var(--color-borde)",
        background: "var(--color-superficie)",
      }}
    >
      <div style={{ width: "4px", background: COLOR_MARCA }} />
      <div className="flex-1">
        <button
          onClick={onClick}
          className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <p
              className="text-xs uppercase tracking-wide font-medium"
              style={{ color: "var(--color-texto-suave)" }}
            >
              {etiqueta}
            </p>
            <div className="flex items-center gap-1.5">
              <Icono size={16} style={{ color: COLOR_MARCA }} />
              <span
                className="text-xs"
                style={{ color: "var(--color-accion)" }}
              >
                {expandido ? "▲" : "▼"}
              </span>
            </div>
          </div>
          <p
            className="text-2xl font-bold dato-numerico"
            style={{ color: COLOR_MARCA }}
          >
            {valor}
          </p>
        </button>

        <AnimatePresence>
          {expandido && (
            <motion.div
              initial="oculto"
              animate="visible"
              exit="oculto"
              variants={listaInternaVariants}
              style={{ overflow: "hidden" }}
            >
              <div className="px-4 pb-3">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function IconoTelefono({ tipo }: { tipo: string }) {
  if (tipo === "celular")
    return (
      <Smartphone size={13} style={{ color: "var(--color-texto-suave)" }} />
    );
  if (tipo === "fijo")
    return (
      <PhoneCall size={13} style={{ color: "var(--color-texto-suave)" }} />
    );
  return null;
}

type TarjetaId =
  | "cuentas"
  | "telefonos"
  | "garantias"
  | "citas"
  | "direcciones"
  | "asignaciones";

export default function PanelResumenCliente({ idc }: { idc: string }) {
  const [resumen, setResumen] = useState<ResumenCliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tarjetaExpandida, setTarjetaExpandida] = useState<TarjetaId | null>(
    null,
  );

  useEffect(() => {
    setCargando(true);
    setError(null);
    setTarjetaExpandida(null);

    fetch(`/api/cliente-resumen/${idc}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "No se pudo cargar el resumen.");
          return;
        }
        setResumen(data);
      })
      .finally(() => setCargando(false));
  }, [idc]);

  function alternarTarjeta(nombre: TarjetaId) {
    setTarjetaExpandida((actual) => (actual === nombre ? null : nombre));
  }

  return (
    <AnimatePresence>
      <motion.div
        key={idc}
        initial="oculto"
        animate="visible"
        exit="salida"
        variants={contenedorVariants}
        style={{ overflow: "hidden" }}
        layout
      >
        <div
          className="rounded border p-5 mt-4"
          style={{
            borderColor: "var(--color-borde)",
            background: "var(--color-fondo)",
          }}
        >
          {cargando && (
            <p
              className="text-sm"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Cargando resumen...
            </p>
          )}

          {error && (
            <p className="text-sm" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          )}

          {!cargando && !error && resumen && (
            <>
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p
                    className="text-xs uppercase tracking-wide"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    Resumen del cliente
                  </p>
                  <h3 className="text-lg font-semibold">{resumen.cliente}</h3>
                </div>
                {resumen.segmentacion && (
                  <span
                    className={`chip ${chipPorSegmentacion(resumen.segmentacion)}`}
                  >
                    {resumen.segmentacion}
                  </span>
                )}
              </div>

              <motion.div
                layout
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                <motion.div
                  custom={0}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                >
                  <TarjetaEstadistica
                    etiqueta="Deuda total"
                    valor={formatearMoneda(resumen.deudaTotal)}
                    icono={Wallet}
                  />
                </motion.div>

                <motion.div
                  custom={1}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                  className={
                    tarjetaExpandida === "cuentas"
                      ? "col-span-2 md:col-span-2"
                      : ""
                  }
                >
                  <TarjetaExpandible
                    etiqueta="Cuentas activas"
                    valor={resumen.cantidadCuentas}
                    icono={Landmark}
                    expandido={tarjetaExpandida === "cuentas"}
                    onClick={() => alternarTarjeta("cuentas")}
                  >
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {resumen.cuentas.map((c) => (
                        <div
                          key={c.codcuentacobranza}
                          className="flex justify-between items-center py-1.5 px-2 rounded text-sm hover:bg-gray-50 transition-colors"
                        >
                          <span
                            className="dato-numerico text-xs"
                            style={{ color: "var(--color-texto-suave)" }}
                          >
                            {c.codcuentacobranza}
                          </span>
                          <span className="dato-numerico font-medium">
                            {formatearMoneda(c.mtodeuda_sol ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TarjetaExpandible>
                </motion.div>

                <motion.div
                  custom={2}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                >
                  <TarjetaEstadistica
                    etiqueta="Mora promedio"
                    valor={`${resumen.moraPromedio} días`}
                    icono={AlarmClock}
                    acento={resumen.moraPromedio > 365 ? "alerta" : "neutral"}
                  />
                </motion.div>

                <motion.div
                  custom={3}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                  className={
                    tarjetaExpandida === "telefonos"
                      ? "col-span-2 md:col-span-2"
                      : ""
                  }
                >
                  <TarjetaExpandible
                    etiqueta="Teléfonos"
                    valor={resumen.cantidadTelefonos}
                    icono={Phone}
                    expandido={tarjetaExpandida === "telefonos"}
                    onClick={() => alternarTarjeta("telefonos")}
                  >
                    <div className="max-h-56 overflow-y-auto space-y-1.5">
                      {resumen.telefonos.map((t) => (
                        <div
                          key={t.id_phone}
                          className="py-1.5 px-2 rounded text-sm hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="dato-numerico font-medium flex items-center gap-1.5">
                              {t.phone}
                              {t.agregado_manualmente === 1 && (
                                <span className="chip chip-accion">Manual</span>
                              )}
                            </span>
                            <span
                              className="flex items-center gap-1.5 text-xs"
                              style={{ color: "var(--color-texto-suave)" }}
                            >
                              <IconoTelefono tipo={t.tipo_telefono} />
                              {t.tipo_telefono}
                            </span>
                          </div>
                          {(t.creado_por || t.editado_por) && (
                            <p
                              className="text-xs mt-0.5"
                              style={{
                                color: "var(--color-texto-tenue, #a1a1aa)",
                              }}
                            >
                              {t.editado_por ?? t.creado_por} ·{" "}
                              {formatearFechaCorta(t.fecha_modificacion)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </TarjetaExpandible>
                </motion.div>

                <motion.div
                  custom={4}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                >
                  <TarjetaEstadistica
                    etiqueta="Gestiones históricas"
                    valor={resumen.gestionesHistoricas}
                    icono={History}
                  />
                </motion.div>

                <motion.div
                  custom={5}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                >
                  <TarjetaEstadistica
                    etiqueta="Contactabilidad"
                    valor={`${resumen.contactabilidadPorcentaje}%`}
                    icono={Target}
                    acento={
                      resumen.contactabilidadPorcentaje >= 50
                        ? "positivo"
                        : "alerta"
                    }
                  />
                </motion.div>

                <motion.div
                  custom={6}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                >
                  <TarjetaEstadistica
                    etiqueta="Última gestión"
                    valor={formatearFecha(resumen.ultimaGestionFecha)}
                    icono={Clock}
                  />
                </motion.div>

                <motion.div
                  custom={7}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                  className={
                    tarjetaExpandida === "garantias"
                      ? "col-span-2 md:col-span-2"
                      : ""
                  }
                >
                  <TarjetaExpandible
                    etiqueta="Garantías"
                    valor={resumen.garantias.length}
                    icono={ShieldCheck}
                    expandido={tarjetaExpandida === "garantias"}
                    onClick={() => alternarTarjeta("garantias")}
                  >
                    {resumen.garantias.length === 0 ? (
                      <p
                        className="text-sm py-2"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Sin garantías registradas.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1.5">
                        {resumen.garantias.map((g) => (
                          <div
                            key={g.gar_codigo}
                            className="py-1.5 px-2 rounded text-sm hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex justify-between items-center">
                              <div className="min-w-0">
                                <p
                                  className="dato-numerico text-xs"
                                  style={{ color: "var(--color-texto-suave)" }}
                                >
                                  {g.gar_codigo}
                                </p>
                                <p className="text-xs">
                                  {g.tipo_garantia ?? "—"}
                                </p>
                              </div>
                              <span className="dato-numerico font-medium">
                                {formatearMoneda(g.monto_realizacion ?? 0)}
                              </span>
                            </div>
                            {g.descripcion && (
                              <p
                                className="text-xs mt-0.5 truncate"
                                style={{
                                  color: "var(--color-texto-tenue, #a1a1aa)",
                                }}
                                title={g.descripcion}
                              >
                                {g.descripcion}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TarjetaExpandible>
                </motion.div>

                <motion.div
                  custom={8}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                  className={
                    tarjetaExpandida === "citas"
                      ? "col-span-2 md:col-span-2"
                      : ""
                  }
                >
                  <TarjetaExpandible
                    etiqueta="Citas"
                    valor={resumen.citas.length}
                    icono={CalendarClock}
                    expandido={tarjetaExpandida === "citas"}
                    onClick={() => alternarTarjeta("citas")}
                  >
                    {resumen.citas.length === 0 ? (
                      <p
                        className="text-sm py-2"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Sin citas registradas.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-0.5">
                        {resumen.citas.map((c) => (
                          <div
                            key={c.id}
                            className="flex justify-between items-center py-1.5 px-2 rounded text-sm hover:bg-gray-50 transition-colors"
                          >
                            <span className="chip chip-accion">{c.tipo}</span>
                            <span
                              className="text-xs"
                              style={{ color: "var(--color-texto-suave)" }}
                            >
                              {formatearFechaCorta(c.fecha_cita)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TarjetaExpandible>
                </motion.div>

                <motion.div
                  custom={9}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                  className={
                    tarjetaExpandida === "direcciones"
                      ? "col-span-2 md:col-span-2"
                      : ""
                  }
                >
                  <TarjetaExpandible
                    etiqueta="Direcciones"
                    valor={resumen.direcciones.length}
                    icono={MapPin}
                    expandido={tarjetaExpandida === "direcciones"}
                    onClick={() => alternarTarjeta("direcciones")}
                  >
                    {resumen.direcciones.length === 0 ? (
                      <p
                        className="text-sm py-2"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Sin direcciones registradas.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1.5">
                        {resumen.direcciones.map((d) => (
                          <div
                            key={d.id}
                            className="py-1.5 px-2 rounded text-sm hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className="truncate">{d.direccion}</span>
                              <span
                                className={`chip ${d.fuente === "manual" ? "chip-accion" : "chip-neutral"} shrink-0`}
                              >
                                {d.fuente === "manual"
                                  ? "Manual"
                                  : "Portafolio"}
                              </span>
                            </div>
                            <p
                              className="text-xs mt-0.5"
                              style={{
                                color: "var(--color-texto-tenue, #a1a1aa)",
                              }}
                            >
                              {d.tipo} ·{" "}
                              {[d.departamento, d.provincia, d.distrito]
                                .filter(Boolean)
                                .join(" / ") || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TarjetaExpandible>
                </motion.div>

                <motion.div
                  custom={10}
                  initial="oculto"
                  animate="visible"
                  variants={tarjetaVariants}
                  layout
                  className="col-span-2 md:col-span-2"
                >
                  <TarjetaExpandible
                    etiqueta="Asignaciones (Router)"
                    valor={resumen.historialRouter.length}
                    icono={Route}
                    expandido={tarjetaExpandida === "asignaciones"}
                    onClick={() => alternarTarjeta("asignaciones")}
                  >
                    {resumen.historialRouter.length === 0 ? (
                      <p
                        className="text-sm py-2"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Sin historial de asignaciones — se acumula desde el
                        próximo cambio de Router.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {resumen.historialRouter.map((h) => (
                          <div
                            key={h.id}
                            className="py-1 px-2 rounded text-xs hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium">{h.seguimiento}</span>
                            <span style={{ color: "var(--color-texto-suave)" }}>
                              {" "}
                              · {formatearFechaCorta(h.fecha_registro)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TarjetaExpandible>
                </motion.div>
              </motion.div>

              {(resumen.expediente ||
                resumen.tipoJuicio ||
                resumen.nroJuicio) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.25 }}
                  className="mt-4 rounded border p-4"
                  style={{
                    borderColor: "var(--color-borde)",
                    background: "var(--color-superficie)",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <Scale size={16} style={{ color: COLOR_MARCA }} />
                    <p className="text-sm font-semibold">
                      Información Judicial
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Expediente
                      </p>
                      <p className="font-medium">{resumen.expediente ?? "—"}</p>
                    </div>
                    <div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        N° Juicio
                      </p>
                      <p className="font-medium">{resumen.nroJuicio ?? "—"}</p>
                    </div>
                    <div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Tipo de Juicio
                      </p>
                      <p className="font-medium">{resumen.tipoJuicio ?? "—"}</p>
                    </div>
                    <div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Fecha de Demanda
                      </p>
                      <p className="font-medium">
                        {formatearFechaCorta(resumen.fecDemanda)}
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Supervisor Procesal
                      </p>
                      <p className="font-medium">
                        {resumen.supervisorProcesal ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        Analista Procesal
                      </p>
                      <p className="font-medium">
                        {resumen.analistaProcesal ?? "—"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.44, duration: 0.25 }}
                className="mt-4 rounded border p-4"
                style={{
                  borderColor: "var(--color-borde)",
                  background: "var(--color-superficie)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <HandCoins size={16} style={{ color: COLOR_MARCA }} />
                  <p className="text-sm font-semibold">Promesas de Pago</p>
                </div>

                {resumen.promesas.length === 0 ? (
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    Este cliente no tiene promesas de pago registradas.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {resumen.promesas.map((p) => {
                      const estilo = ESTILO_ESTADO_PROMESA[p.estado];
                      return (
                        <li
                          key={p.id}
                          className="text-sm border-l-2 pl-3"
                          style={{ borderColor: estilo.color }}
                        >
                          <div className="flex justify-between items-baseline flex-wrap gap-1">
                            <span className="font-medium">
                              {p.tipo} — Promesa de pago
                            </span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: estilo.color }}
                            >
                              {estilo.etiqueta}
                            </span>
                          </div>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--color-texto-suave)" }}
                          >
                            {formatearMoneda(
                              p.monto_deuda_total ?? 0,
                              p.moneda,
                            )}{" "}
                            · Vencimiento:{" "}
                            {formatearFechaCorta(p.fecha_promesa)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </motion.div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
