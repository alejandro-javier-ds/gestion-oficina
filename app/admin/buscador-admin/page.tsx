// app/admin/buscador-admin/page.tsx
// Buscador de clientes para consulta rápida del admin. Responsive
// completo (celular → monitor grande) + Framer Motion: crossfade
// entre skeleton/vacío/resultados, búsquedas recientes entrando
// suave, filas de resultado con stagger y layout animado.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, History, X, Users } from "lucide-react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";
import BuscadorInput from "@/components/BuscadorInput";
import PanelResumenCliente from "@/components/PanelResumenCliente";

type ResultadoCliente = {
  idc: string;
  cliente: string;
  cantidadCuentas: number;
  montoDeudaTotal: number;
  primeraCuenta: string;
  segmentacion: string | null;
};

const CLAVE_BUSQUEDAS_RECIENTES = "buscador_admin_recientes";
const MAX_BUSQUEDAS_RECIENTES = 5;

function chipPorSegmentacion(segmentacion: string | null): string {
  if (!segmentacion) return "chip-neutral";
  const texto = segmentacion.toUpperCase();
  if (texto.includes("CONTACTO CON NEGOCIACION")) return "chip-exito";
  if (texto.includes("NO CONTACTO")) return "chip-alerta";
  if (texto.includes("REMATADO")) return "chip-neutral";
  return "chip-neutral";
}

function obtenerInicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase();
}

function formatearMoneda(valor: number): string {
  return `S/ ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function FilaEsqueleto() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 animate-pulse">
      <div
        className="w-9 h-9 rounded-full shrink-0"
        style={{ background: "var(--color-fondo-sutil)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3 rounded"
          style={{ background: "var(--color-fondo-sutil)", width: "40%" }}
        />
        <div
          className="h-2.5 rounded"
          style={{ background: "var(--color-fondo-sutil)", width: "25%" }}
        />
      </div>
      <div
        className="h-5 w-16 rounded-full shrink-0"
        style={{ background: "var(--color-fondo-sutil)" }}
      />
    </div>
  );
}

export default function BuscadorAdminPage() {
  const [cuentas, setCuentas] = useState<ResultadoCliente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [idcSeleccionado, setIdcSeleccionado] = useState<string | null>(null);
  const [ultimaBusqueda, setUltimaBusqueda] = useState("");
  const [busquedasRecientes, setBusquedasRecientes] = useState<string[]>([]);

  useEffect(() => {
    const guardadas = localStorage.getItem(CLAVE_BUSQUEDAS_RECIENTES);
    if (guardadas) setBusquedasRecientes(JSON.parse(guardadas));
  }, []);

  function guardarBusquedaReciente(texto: string) {
    setBusquedasRecientes((actual) => {
      const nuevas = [texto, ...actual.filter((t) => t !== texto)].slice(
        0,
        MAX_BUSQUEDAS_RECIENTES,
      );
      localStorage.setItem(CLAVE_BUSQUEDAS_RECIENTES, JSON.stringify(nuevas));
      return nuevas;
    });
  }

  function quitarBusquedaReciente(texto: string, e: React.MouseEvent) {
    e.stopPropagation();
    setBusquedasRecientes((actual) => {
      const nuevas = actual.filter((t) => t !== texto);
      localStorage.setItem(CLAVE_BUSQUEDAS_RECIENTES, JSON.stringify(nuevas));
      return nuevas;
    });
  }

  async function buscar(texto: string) {
    if (!texto.trim()) return;
    setCargando(true);
    setIdcSeleccionado(null);
    setUltimaBusqueda(texto);

    const res = await fetch(`/api/buscar?q=${encodeURIComponent(texto)}`);
    const data = await res.json();
    setCuentas(data.resultados ?? []);
    setCargando(false);
    guardarBusquedaReciente(texto);
  }

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <HeaderPanelAdmin
        titulo="Buscar cliente"
        descripcion="Consulta rápida — sin restricción de cartera. Haz clic en un cliente para ver su resumen."
      />

      <div className="tarjeta p-4 sm:p-5">
        <BuscadorInput onBuscar={buscar} />

        <AnimatePresence>
          {busquedasRecientes.length > 0 &&
            cuentas.length === 0 &&
            !cargando && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-wrap items-center gap-2 overflow-hidden"
              >
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  <History size={13} />
                  Recientes:
                </span>
                {busquedasRecientes.map((texto) => (
                  <button
                    key={texto}
                    onClick={() => buscar(texto)}
                    className="chip chip-neutral flex items-center gap-1"
                    style={{ cursor: "pointer" }}
                  >
                    {texto}
                    <X
                      size={11}
                      onClick={(e) => quitarBusquedaReciente(texto, e)}
                      className="hover:opacity-70"
                    />
                  </button>
                ))}
              </motion.div>
            )}
        </AnimatePresence>

        <div className="mt-4">
          <AnimatePresence mode="wait">
            {cargando && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-1"
              >
                {[1, 2, 3, 4].map((i) => (
                  <FilaEsqueleto key={i} />
                ))}
              </motion.div>
            )}

            {!cargando && ultimaBusqueda && cuentas.length === 0 && (
              <motion.div
                key="sin-resultados"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center gap-2 py-10"
              >
                <Users
                  size={32}
                  style={{ color: "var(--color-texto-tenue)" }}
                />
                <p
                  className="text-sm text-center px-4"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Sin resultados para &quot;{ultimaBusqueda}&quot;.
                </p>
              </motion.div>
            )}

            {!cargando && cuentas.length > 0 && (
              <motion.div
                key="resultados"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="chip chip-neutral">
                    {cuentas.length} resultado{cuentas.length !== 1 ? "s" : ""}{" "}
                    encontrado{cuentas.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-1">
                  {cuentas.map((c, i) => {
                    const seleccionado = c.idc === idcSeleccionado;
                    return (
                      <motion.div
                        key={c.idc}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        onClick={() =>
                          setIdcSeleccionado(seleccionado ? null : c.idc)
                        }
                        className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                        style={{
                          background: seleccionado
                            ? "var(--color-accion-suave)"
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!seleccionado)
                            e.currentTarget.style.background =
                              "var(--color-fondo-sutil)";
                        }}
                        onMouseLeave={(e) => {
                          if (!seleccionado)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                          style={{
                            background: "var(--color-marca)",
                            color: "white",
                          }}
                        >
                          {obtenerInicial(c.cliente)}
                        </div>

                        <div className="min-w-0 flex-1 basis-[140px]">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--color-texto)" }}
                          >
                            {c.cliente}
                          </p>
                          <p
                            className="text-xs dato-numerico"
                            style={{ color: "var(--color-texto-suave)" }}
                          >
                            IDC {c.idc} · {c.cantidadCuentas}{" "}
                            {c.cantidadCuentas === 1 ? "cuenta" : "cuentas"}
                          </p>
                        </div>

                        <span
                          className="text-sm font-semibold dato-numerico shrink-0 ml-auto sm:ml-0"
                          style={{ color: "var(--color-marca)" }}
                        >
                          {formatearMoneda(c.montoDeudaTotal)}
                        </span>

                        {c.segmentacion && (
                          <span
                            className={`chip ${chipPorSegmentacion(c.segmentacion)} shrink-0 hidden md:inline-flex`}
                          >
                            {c.segmentacion}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {!cargando && !ultimaBusqueda && (
              <motion.div
                key="inicial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center gap-2 py-10"
              >
                <Search
                  size={32}
                  style={{ color: "var(--color-texto-tenue)" }}
                />
                <p
                  className="text-sm text-center px-4"
                  style={{ color: "var(--color-texto-suave)" }}
                >
                  Busca por IDC o nombre para empezar.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {idcSeleccionado && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <PanelResumenCliente idc={idcSeleccionado} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
