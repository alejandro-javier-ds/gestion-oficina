// components/FichaCliente.tsx
// La ficha completa de un cliente.

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCw, ChevronRight, CreditCard, Landmark, X } from "lucide-react";

import HeaderCliente from "@/components/HeaderCliente";
import HistorialTabs from "@/components/HistorialTabs";
import PanelRegistrarGestiones from "@/components/PanelRegistrarGestiones";
import SeccionTelefonos from "@/components/SeccionTelefonos";
import SeccionDirecciones from "@/components/SeccionDirecciones";
import CuentaFinanciera from "@/components/CuentaFinanciera";
import { Cuenta, Garantia, Apersonamiento } from "@/lib/types";

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
  qtty_phone_ranking: number | null;
  creado_por: string | null;
  editado_por: string | null;
  fecha_modificacion: string | null;
  agregado_manualmente: number;
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

type HistorialRouter = {
  id: number;
  fecha_registro: string;
  seguimiento: string;
  router: string;
  descripcion: string | null;
};

type DatosCliente = {
  idc: string;
  cliente: string;
  prioridad: string | null;
  router: string | null;
  nivelRiesgo: string | null;
  segmentacion: string | null;
  funcionario: string | null;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  expediente: string | null;
  tipoJuicio: string | null;
  nroJuicio: string | null;
  fecDemanda: string | null;
  supervisorProcesal: string | null;
  analistaProcesal: string | null;
  cuentas: Cuenta[];
  garantias: Garantia[];
  telefonos: Telefono[];
  direcciones: Direccion[];
  cic: string | null;
  apersonamiento: Apersonamiento[];
  historialRouter: HistorialRouter[];
};

type Sesion = {
  nombreCompleto: string;
  rol: "administrador" | "supervisor" | "abogado" | "gestor";
};

type TabPrincipal =
  | "productos"
  | "datos"
  | "telefonos"
  | "direcciones"
  | "historial";

type SubTabProductos = "activos" | "garantias";

const ICONO_VERDE = "#4BCA81";
const AZUL_LINK = "#0176D3";

function formatearMoneda(valor: number | null, moneda?: string | null): string {
  if (valor == null) return "—";

  const esDolares =
    moneda === "DOLARES" ||
    moneda === "DÓLARES" ||
    moneda === "Dolares" ||
    moneda === "Dólares" ||
    moneda === "USD";

  const simbolo = esDolares ? "US$" : "PEN";

  return `${simbolo} ${valor.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function normalizarCodigoMoneda(moneda: string | null): "USD" | "PEN" | "—" {
  const valor = String(moneda ?? "")
    .trim()
    .toUpperCase();

  if (valor === "USD" || valor.includes("DOLAR")) return "USD";
  if (valor === "PEN" || valor.includes("SOL")) return "PEN";

  return "—";
}

function obtenerMonedaCuenta(cuenta: Cuenta): "USD" | "PEN" | "—" {
  return normalizarCodigoMoneda(cuenta.codmoneda);
}

function formatearDeudaCuenta(
  cuenta: Cuenta,
  tipo: "total" | "vencida",
): string {
  const moneda = obtenerMonedaCuenta(cuenta);

  const montoOrigen =
    tipo === "total"
      ? cuenta.deudatotal_monedaorigen
      : cuenta.deudavencida_monedaorigen;

  if (montoOrigen != null) {
    return formatearMoneda(montoOrigen, moneda === "USD" ? "USD" : "PEN");
  }

  const montoSoles =
    tipo === "total" ? cuenta.mtodeuda_sol : cuenta.mtodeudavencida_sol;

  return formatearMoneda(montoSoles, moneda === "USD" ? "USD" : "PEN");
}

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";

  const fecha = new Date(iso);

  if (isNaN(fecha.getTime())) return String(iso);

  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function agruparPorTipoProducto(cuentas: Cuenta[]): {
  nombre: string;
  icono: React.ReactNode;
  cuentas: Cuenta[];
}[] {
  const tarjetas = cuentas.filter((c) =>
    (c.descproducto ?? "").toUpperCase().includes("TARJETA"),
  );

  const creditos = cuentas.filter(
    (c) => !(c.descproducto ?? "").toUpperCase().includes("TARJETA"),
  );

  const grupos: {
    nombre: string;
    icono: React.ReactNode;
    cuentas: Cuenta[];
  }[] = [];

  if (tarjetas.length > 0) {
    grupos.push({
      nombre: "Tarjeta de Crédito",
      icono: <CreditCard size={15} className="text-white" />,
      cuentas: tarjetas,
    });
  }

  if (creditos.length > 0) {
    grupos.push({
      nombre: "Créditos",
      icono: <Landmark size={15} className="text-white" />,
      cuentas: creditos,
    });
  }

  return grupos;
}

function TabTexto({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 min-h-11 px-4 py-3 text-[13px] uppercase whitespace-nowrap transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
      style={{
        color: activo ? "var(--color-texto)" : "var(--color-texto-suave)",
        borderBottom: activo
          ? `2px solid ${AZUL_LINK}`
          : "2px solid transparent",
        fontWeight: activo ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function SubTabTexto({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 min-h-10 px-4 py-2 text-[13px] whitespace-nowrap transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
      style={{
        color: activo ? "var(--color-texto)" : "var(--color-texto-suave)",
        borderBottom: activo
          ? `2px solid ${AZUL_LINK}`
          : "2px solid transparent",
        fontWeight: activo ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Campo({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex flex-col text-xs py-1.5 min-w-0">
      <span className="font-semibold" style={{ color: "#1E40AF" }}>
        {etiqueta}
      </span>

      <span className="text-gray-900 font-medium mt-0.5 break-words">
        {valor ?? "—"}
      </span>
    </div>
  );
}

function SeccionAcordeon({
  titulo,
  children,
  abiertoPorDefecto = true,
}: {
  titulo: string;
  children: React.ReactNode;
  abiertoPorDefecto?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  return (
    <div style={{ borderTop: "1px solid #E5E7EB" }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-1.5 text-left min-h-11 p-2.5 transition-colors hover:brightness-[0.99] focus-visible:outline-none"
        style={{
          background: "#F3F4F6",
          borderLeft: "2px solid #F97316",
        }}
        aria-expanded={abierto}
      >
        <span className="text-gray-500 shrink-0">{abierto ? "▾" : "▸"}</span>

        <h3
          className="text-sm font-semibold truncate"
          style={{ color: "#1E3A8A" }}
        >
          {titulo}
        </h3>
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GrupoProductos({
  nombre,
  icono,
  cuentas,
  onAbrirCuenta,
}: {
  nombre: string;
  icono: React.ReactNode;
  cuentas: Cuenta[];
  onAbrirCuenta: (cuenta: Cuenta) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <div
        className="flex items-center justify-between gap-3 p-2"
        style={{
          background: "#F8F9FB",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="rounded p-1 shrink-0"
            style={{ background: ICONO_VERDE }}
          >
            {icono}
          </div>

          <h3 className="text-[14px] font-bold text-gray-900 truncate">
            {nombre} ({cuentas.length})
          </h3>
        </div>

        <button
          type="button"
          className="bg-white border border-gray-300 rounded p-1 hover:bg-gray-50 text-gray-500 shadow-sm shrink-0 transition-colors focus-visible:outline-none"
          aria-label={`Actualizar ${nombre}`}
        >
          <RotateCw size={13} />
        </button>
      </div>

      <div className="tabla-scroll">
        <table
          className="text-left border-collapse"
          style={{ minWidth: "760px" }}
        >
          <thead style={{ borderBottom: "1px solid #E5E7EB" }}>
            <tr>
              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Número de Cuenta
              </th>

              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Moneda
              </th>

              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Nombre del Producto
              </th>

              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                Días Mora
              </th>

              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                Deuda Vencida
              </th>

              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                Deuda Total
              </th>

              <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Estado
              </th>

              <th className="w-8" />
            </tr>
          </thead>

          <tbody className="text-[12px] text-gray-800">
            {cuentas.map((c, i) => (
              <motion.tr
                key={c.codcuentacobranza}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.14,
                  delay: Math.min(i * 0.015, 0.18),
                }}
                whileTap={{ scale: 0.998 }}
                onClick={() => onAbrirCuenta(c)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onAbrirCuenta(c);
                  }
                }}
                tabIndex={0}
                role="button"
                className="cursor-pointer group focus-visible:outline-none"
                style={{
                  background: i % 2 === 1 ? "#FAFAFA" : "white",
                  borderTop: "1px solid #F3F4F6",
                }}
                whileHover={{
                  backgroundColor: "#F9FAFB",
                }}
              >
                <td
                  className="py-2 px-3 whitespace-nowrap"
                  style={{ color: AZUL_LINK }}
                >
                  {c.codcuentacobranza}
                </td>

                <td className="py-2 px-3 font-medium whitespace-nowrap">
                  {obtenerMonedaCuenta(c)}
                </td>

                <td
                  className="py-2 px-3 whitespace-nowrap"
                  style={{ color: AZUL_LINK }}
                  title={c.descproducto ?? undefined}
                >
                  <span className="block max-w-[220px] truncate">
                    {c.descproducto ?? "—"}
                  </span>
                </td>

                <td className="py-2 px-3 text-right whitespace-nowrap">
                  {c.diasmora ?? 0}
                </td>

                <td className="py-2 px-3 text-right whitespace-nowrap">
                  {formatearDeudaCuenta(c, "vencida")}
                </td>

                <td className="py-2 px-3 text-right whitespace-nowrap">
                  {formatearDeudaCuenta(c, "total")}
                </td>

                <td className="py-2 px-3 whitespace-nowrap">
                  {c.estado_cartera ?? "—"}
                </td>

                <td className="py-2 px-2 text-center">
                  <ChevronRight
                    size={13}
                    className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PestanaAnidada({
  activa,
  etiqueta,
  onClick,
  onCerrar,
}: {
  activa: boolean;
  etiqueta: string;
  onClick: () => void;
  onCerrar?: () => void;
}) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.15 }}
      className="shrink-0"
    >
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className="flex items-center gap-1.5 min-h-10 px-3 py-1.5 text-xs cursor-pointer shrink-0 border-r transition-colors hover:bg-white focus-visible:outline-none"
        style={{
          borderColor: "#E5E7EB",
          borderBottom: activa
            ? `2px solid ${AZUL_LINK}`
            : "2px solid transparent",
          background: activa ? "white" : "#F8F9FB",
          color: activa ? "#111827" : "#6B7280",
          maxWidth: 190,
        }}
      >
        <span className="truncate font-medium dato-numerico">{etiqueta}</span>

        {onCerrar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCerrar();
            }}
            className="shrink-0 flex h-5 w-5 items-center justify-center rounded hover:bg-black/10 focus-visible:outline-none transition-colors"
            aria-label={`Cerrar ${etiqueta}`}
          >
            <X size={11} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function FichaCliente({
  idc,
  onNombreCliente,
}: {
  idc: string;
  onNombreCliente?: (nombre: string) => void;
}) {
  const [datos, setDatos] = useState<DatosCliente | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);

  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("productos");

  const [subTabProductos, setSubTabProductos] =
    useState<SubTabProductos>("activos");

  const [refrescarSenal, setRefrescarSenal] = useState(0);

  const [cuentasAbiertas, setCuentasAbiertas] = useState<Cuenta[]>([]);

  const [pestanaAnidadaActiva, setPestanaAnidadaActiva] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetch("/api/sesion")
      .then((res) => res.json())
      .then((data) => setSesion(data.sesion ?? null))
      .catch(() => setSesion(null));
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setErrorAcceso(null);

    const res = await fetch(`/api/cliente/${idc}`);
    const data = await res.json();

    if (!res.ok) {
      setErrorAcceso(data.error ?? "No se pudo cargar el cliente.");
      setCargando(false);
      return;
    }

    setDatos(data);
    onNombreCliente?.(data.cliente);
    setCargando(false);
  }

  useEffect(() => {
    cargarDatos();
  }, [idc]);

  function abrirCuenta(cuenta: Cuenta) {
    setCuentasAbiertas((actual) => {
      if (
        actual.some((c) => c.codcuentacobranza === cuenta.codcuentacobranza)
      ) {
        return actual;
      }

      return [...actual, cuenta];
    });

    setPestanaAnidadaActiva(cuenta.codcuentacobranza);
  }

  function cerrarCuenta(codigo: string) {
    setCuentasAbiertas((actual) => {
      const indice = actual.findIndex((c) => c.codcuentacobranza === codigo);

      const nuevas = actual.filter((c) => c.codcuentacobranza !== codigo);

      if (pestanaAnidadaActiva === codigo) {
        if (nuevas.length === 0) {
          setPestanaAnidadaActiva(null);
        } else if (indice < nuevas.length) {
          setPestanaAnidadaActiva(nuevas[indice].codcuentacobranza);
        } else {
          setPestanaAnidadaActiva(nuevas[nuevas.length - 1].codcuentacobranza);
        }
      }

      return nuevas;
    });
  }

  if (cargando) {
    return (
      <div className="tema-gestor min-h-[60vh] flex items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm"
          style={{ color: "var(--color-texto-suave)" }}
        >
          Cargando...
        </motion.p>
      </div>
    );
  }

  if (errorAcceso) {
    return (
      <div className="tema-gestor p-4 sm:p-6">
        <p style={{ color: "var(--color-error)" }}>{errorAcceso}</p>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="tema-gestor p-4 sm:p-6">
        <p style={{ color: "var(--color-texto-suave)" }}>
          Cliente no encontrado.
        </p>
      </div>
    );
  }

  const gruposProductos = agruparPorTipoProducto(datos.cuentas);

  const TABS: {
    id: TabPrincipal;
    etiqueta: string;
  }[] = [
    { id: "productos", etiqueta: "Productos" },
    { id: "datos", etiqueta: "Datos Generales" },
    { id: "telefonos", etiqueta: "Teléfonos" },
    { id: "direcciones", etiqueta: "Direcciones" },
    { id: "historial", etiqueta: "Historial" },
  ];

  const cuentaAnidadaActual = cuentasAbiertas.find(
    (c) => c.codcuentacobranza === pestanaAnidadaActiva,
  );

  return (
    <div className="tema-gestor min-w-0">
      <HeaderCliente
        idc={datos.idc}
        cliente={datos.cliente}
        cic={datos.cic}
        prioridad={datos.prioridad}
        router={datos.router}
        nivelRiesgo={datos.nivelRiesgo}
        segmentacion={datos.segmentacion}
        rol={sesion?.rol}
        onCrearGestion={() =>
          document.getElementById(`panel-gestion-${idc}`)?.scrollIntoView({
            behavior: "smooth",
          })
        }
      />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pb-6 pt-3">
        {cuentasAbiertas.length > 0 && (
          <div
            className="flex overflow-x-auto overscroll-x-contain mb-2 rounded-t"
            style={{
              background: "#F3F4F6",
              border: "1px solid #E5E7EB",
              borderBottom: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <PestanaAnidada
              activa={pestanaAnidadaActiva === null}
              etiqueta={datos.cliente}
              onClick={() => setPestanaAnidadaActiva(null)}
            />

            <AnimatePresence initial={false} mode="popLayout">
              {cuentasAbiertas.map((c) => (
                <PestanaAnidada
                  key={c.codcuentacobranza}
                  activa={pestanaAnidadaActiva === c.codcuentacobranza}
                  etiqueta={c.codcuentacobranza}
                  onClick={() => setPestanaAnidadaActiva(c.codcuentacobranza)}
                  onCerrar={() => cerrarCuenta(c.codcuentacobranza)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence mode="wait">
          {cuentaAnidadaActual && (
            <motion.div
              key={cuentaAnidadaActual.codcuentacobranza}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-b border border-gray-200 shadow-sm overflow-hidden"
            >
              <CuentaFinanciera cuenta={cuentaAnidadaActual} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={pestanaAnidadaActiva === null ? "block" : "hidden"}>
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 min-w-0 w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex overflow-x-auto overscroll-x-contain border-b border-gray-200 bg-white px-1 sm:px-2">
                {TABS.map((tab) => (
                  <TabTexto
                    key={tab.id}
                    activo={tabPrincipal === tab.id}
                    onClick={() => setTabPrincipal(tab.id)}
                  >
                    {tab.etiqueta}
                  </TabTexto>
                ))}
              </div>

              <div className="p-3 sm:p-4">
                <AnimatePresence mode="wait">
                  {tabPrincipal === "productos" && (
                    <motion.div
                      key="productos"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex overflow-x-auto border-b border-gray-200 mb-4">
                        <SubTabTexto
                          activo={subTabProductos === "activos"}
                          onClick={() => setSubTabProductos("activos")}
                        >
                          Activos ({datos.cuentas.length})
                        </SubTabTexto>

                        <SubTabTexto
                          activo={subTabProductos === "garantias"}
                          onClick={() => setSubTabProductos("garantias")}
                        >
                          Garantías ({datos.garantias.length})
                        </SubTabTexto>
                      </div>

                      {subTabProductos === "activos" && (
                        <div>
                          {gruposProductos.length === 0 ? (
                            <p
                              className="text-sm py-6"
                              style={{
                                color: "var(--color-texto-suave)",
                              }}
                            >
                              Este cliente no tiene cuentas activas.
                            </p>
                          ) : (
                            gruposProductos.map((grupo) => (
                              <GrupoProductos
                                key={grupo.nombre}
                                nombre={grupo.nombre}
                                icono={grupo.icono}
                                cuentas={grupo.cuentas}
                                onAbrirCuenta={abrirCuenta}
                              />
                            ))
                          )}
                        </div>
                      )}

                      {subTabProductos === "garantias" && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {datos.garantias.length === 0 ? (
                            <p
                              className="p-4 text-sm"
                              style={{
                                color: "var(--color-texto-suave)",
                              }}
                            >
                              Este cliente no tiene garantías registradas.
                            </p>
                          ) : (
                            <div className="tabla-scroll">
                              <table
                                className="text-left border-collapse"
                                style={{ minWidth: "820px" }}
                              >
                                <thead
                                  style={{
                                    borderBottom: "1px solid #E5E7EB",
                                  }}
                                >
                                  <tr>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                      N° Garantía
                                    </th>

                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                      Tipo
                                    </th>

                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                      Descripción
                                    </th>

                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                      Estado
                                    </th>

                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                      Moneda
                                    </th>

                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                                      Valor Comercial
                                    </th>

                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                                      Valor de Realización
                                    </th>
                                  </tr>
                                </thead>

                                <tbody className="text-[12px] text-gray-800">
                                  {datos.garantias.map((g, i) => (
                                    <motion.tr
                                      key={g.gar_codigo}
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{
                                        duration: 0.13,
                                        delay: Math.min(i * 0.01, 0.15),
                                      }}
                                      style={{
                                        background:
                                          i % 2 === 1 ? "#FAFAFA" : "white",
                                        borderTop: "1px solid #F3F4F6",
                                      }}
                                    >
                                      <td
                                        className="py-2 px-3 whitespace-nowrap"
                                        style={{
                                          color: AZUL_LINK,
                                        }}
                                      >
                                        {g.gar_codigo}
                                      </td>

                                      <td className="py-2 px-3 whitespace-nowrap">
                                        {g.tipo_garantia ?? "—"}
                                      </td>

                                      <td
                                        className="py-2 px-3 max-w-[220px]"
                                        title={g.descripcion ?? undefined}
                                      >
                                        <span className="block truncate">
                                          {g.descripcion ?? "—"}
                                        </span>
                                      </td>

                                      <td className="py-2 px-3 whitespace-nowrap">
                                        Constituida
                                      </td>

                                      <td className="py-2 px-3 whitespace-nowrap">
                                        {g.moneda ?? "—"}
                                      </td>

                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        {formatearMoneda(g.monto_comercial)}
                                      </td>

                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        {formatearMoneda(g.monto_realizacion)}
                                      </td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {tabPrincipal === "datos" && (
                    <motion.div
                      key="datos"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <SeccionAcordeon titulo="Información Personal">
                          <Campo
                            etiqueta="Nombre de la cuenta / Razón social"
                            valor={datos.cliente}
                          />
                          <Campo etiqueta="IDC" valor={datos.idc} />
                        </SeccionAcordeon>

                        <SeccionAcordeon titulo="Clasificación de la cuenta">
                          <Campo
                            etiqueta="Segmentación"
                            valor={datos.segmentacion}
                          />

                          <Campo
                            etiqueta="Nombre de funcionario"
                            valor={
                              <span
                                style={{
                                  color: AZUL_LINK,
                                }}
                              >
                                {datos.funcionario ?? "—"}
                              </span>
                            }
                          />
                        </SeccionAcordeon>

                        <SeccionAcordeon titulo="Información de contactabilidad">
                          <Campo etiqueta="Dirección" valor={datos.direccion} />

                          <Campo etiqueta="Distrito" valor={datos.distrito} />

                          <Campo etiqueta="Provincia" valor={datos.provincia} />

                          <Campo
                            etiqueta="Departamento"
                            valor={datos.departamento}
                          />
                        </SeccionAcordeon>
                      </div>

                      <div className="border border-gray-200 rounded-lg p-4 mt-4">
                        <h2 className="font-semibold mb-3 text-sm">
                          Información Judicial
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Expediente</p>
                            <p className="font-medium break-words">
                              {datos.expediente ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">N° Juicio</p>
                            <p className="font-medium break-words">
                              {datos.nroJuicio ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Tipo de Juicio
                            </p>
                            <p className="font-medium break-words">
                              {datos.tipoJuicio ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Fecha de Demanda
                            </p>
                            <p className="font-medium">
                              {formatearFecha(datos.fecDemanda)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Supervisor Procesal
                            </p>
                            <p className="font-medium break-words">
                              {datos.supervisorProcesal ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Analista Procesal
                            </p>
                            <p className="font-medium break-words">
                              {datos.analistaProcesal ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-lg p-4 mt-4">
                        <h2 className="font-semibold mb-3 text-sm">
                          Apersonamiento
                        </h2>

                        {datos.apersonamiento.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            Sin registros de apersonamiento para este cliente.
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {datos.apersonamiento.map((a) => (
                              <li
                                key={a.id}
                                className="text-sm border-l-2 pl-3"
                                style={{
                                  borderColor: AZUL_LINK,
                                }}
                              >
                                <p className="font-medium break-words">
                                  {a.motivo ?? "Sin motivo especificado"}
                                </p>

                                <p className="text-xs text-gray-500">
                                  Entregado: {formatearFecha(a.fecha_entrega)} ·
                                  Asignado:{" "}
                                  {formatearFecha(a.fec_asignacion_lgm)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {tabPrincipal === "telefonos" && (
                    <motion.div
                      key="telefonos"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SeccionTelefonos
                        idc={idc}
                        telefonos={datos.telefonos}
                        onActualizado={cargarDatos}
                      />
                    </motion.div>
                  )}

                  {tabPrincipal === "direcciones" && (
                    <motion.div
                      key="direcciones"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SeccionDirecciones
                        idc={idc}
                        direcciones={datos.direcciones}
                        onActualizado={cargarDatos}
                      />
                    </motion.div>
                  )}

                  {tabPrincipal === "historial" && (
                    <motion.div
                      key="historial"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <HistorialTabs
                        idc={idc}
                        refrescarSenal={refrescarSenal}
                        historialRouter={datos.historialRouter}
                        rol={sesion?.rol}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div
              id={`panel-gestion-${idc}`}
              className="w-full lg:w-[340px] shrink-0"
            >
              <PanelRegistrarGestiones
                idc={idc}
                cuentas={datos.cuentas}
                telefonos={datos.telefonos}
                onGestionGuardada={() => setRefrescarSenal((n) => n + 1)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
