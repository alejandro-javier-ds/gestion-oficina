// app/page.tsx
//
// Pantalla principal — es el CONTENEDOR de pestañas múltiples,
// como una pestaña nueva al lado, sin perder la búsqueda ni las
// demás pestañas abiertas. Las pestañas persisten en sessionStorage
//
// UX:
// - Header responsive
// - Pestañas con transición suave
// - Toolbar de resultados separada visualmente
// - Mejor experiencia táctil en móvil
// - Botones no disponibles visualmente deshabilitados
//
// La lógica de negocio, búsqueda, sessionStorage, roles y
// persistencia de pestañas se mantiene sin cambios.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import {
  Search,
  LogOut,
  LayoutDashboard,
  Building2,
  RotateCw,
  Settings,
  Columns3,
  Filter,
  ChevronDown,
  Pin,
  X,
} from "lucide-react";

import BuscadorInput from "@/components/BuscadorInput";
import TablaResultados from "@/components/TablaResultados";
import FichaCliente from "@/components/FichaCliente";

type ResultadoCliente = {
  idc: string;
  cliente: string;
  cantidadCuentas: number;
  montoDeudaTotal: number;
  primeraCuenta: string;
  segmentacion: string | null;
};

type Sesion = {
  nombreCompleto: string;
  rol: "administrador" | "supervisor" | "abogado" | "gestor";
};

type PestanaCliente = {
  idc: string;
  nombre: string;
};

const ROLES_CON_PANEL_ADMIN = ["administrador", "abogado"];

const ICONO_CUENTA = "#686DBF";

const CLAVE_ULTIMA_BUSQUEDA = "buscador_gestor_ultima_busqueda";

const CLAVE_PESTANAS = "buscador_gestor_pestanas";

function obtenerIniciales(nombreCompleto: string): string {
  return nombreCompleto
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Pestana({
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
      initial={{
        opacity: 0,
        x: 8,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      exit={{
        opacity: 0,
        x: -8,
      }}
      transition={{
        duration: 0.16,
        ease: "easeOut",
      }}
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
        className="flex items-center gap-2 min-h-11 px-3 sm:px-4 py-2 text-sm cursor-pointer shrink-0 border-r transition-colors hover:bg-[var(--color-superficie)] focus-visible:outline-none"
        style={{
          borderColor: "var(--color-borde)",
          borderTop: activa
            ? "2px solid var(--color-accion)"
            : "2px solid transparent",
          background: activa
            ? "var(--color-superficie)"
            : "var(--color-fondo-sutil)",
          color: activa ? "var(--color-texto)" : "var(--color-texto-suave)",
          maxWidth: 240,
        }}
      >
        <span className="truncate font-medium">{etiqueta}</span>

        {onCerrar && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCerrar();
            }}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-black/10 focus-visible:outline-none"
            style={{
              color: "inherit",
            }}
            aria-label={`Cerrar ${etiqueta}`}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function Home() {
  const router = useRouter();

  const [cuentas, setCuentas] = useState<ResultadoCliente[]>([]);

  const [cargando, setCargando] = useState(false);

  const [ultimaBusqueda, setUltimaBusqueda] = useState("");

  const [filtroLista, setFiltroLista] = useState("");

  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [verificandoRol, setVerificandoRol] = useState(true);

  const [pestanas, setPestanas] = useState<PestanaCliente[]>([]);

  const [pestanaActiva, setPestanaActiva] = useState<string>("cuentas");

  const [pestanasCargadas, setPestanasCargadas] = useState(false);

  useEffect(() => {
    fetch("/api/sesion")
      .then((res) => res.json())
      .then((data) => {
        if (data.sesion && ROLES_CON_PANEL_ADMIN.includes(data.sesion.rol)) {
          router.replace("/admin");
          return;
        }

        setSesion(data.sesion);
        setVerificandoRol(false);

        const guardada = sessionStorage.getItem(CLAVE_ULTIMA_BUSQUEDA);

        if (guardada) {
          const { texto, resultados } = JSON.parse(guardada);

          setUltimaBusqueda(texto);
          setCuentas(resultados);
        }

        const pestanasGuardadas = sessionStorage.getItem(CLAVE_PESTANAS);

        if (pestanasGuardadas) {
          const { pestanas: p, activa } = JSON.parse(pestanasGuardadas);

          setPestanas(p ?? []);
          setPestanaActiva(activa ?? "cuentas");
        }

        setPestanasCargadas(true);
      })
      .catch(() => {
        setVerificandoRol(false);
      });
  }, [router]);

  useEffect(() => {
    if (!pestanasCargadas) {
      return;
    }

    sessionStorage.setItem(
      CLAVE_PESTANAS,
      JSON.stringify({
        pestanas,
        activa: pestanaActiva,
      }),
    );
  }, [pestanas, pestanaActiva, pestanasCargadas]);

  async function buscar(texto: string) {
    if (!texto.trim()) {
      return;
    }

    setCargando(true);
    setUltimaBusqueda(texto);
    setFiltroLista("");

    const res = await fetch(`/api/buscar?q=${encodeURIComponent(texto)}`);

    const data = await res.json();

    const resultados = data.resultados ?? [];

    setCuentas(resultados);
    setCargando(false);

    sessionStorage.setItem(
      CLAVE_ULTIMA_BUSQUEDA,
      JSON.stringify({
        texto,
        resultados,
      }),
    );
  }

  function refrescar() {
    if (ultimaBusqueda) {
      buscar(ultimaBusqueda);
    }
  }

  async function cerrarSesion() {
    sessionStorage.removeItem(CLAVE_ULTIMA_BUSQUEDA);

    sessionStorage.removeItem(CLAVE_PESTANAS);

    await fetch("/api/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  function abrirCliente(idc: string, nombreInicial: string) {
    setPestanas((actual) => {
      if (actual.some((p) => p.idc === idc)) {
        return actual;
      }

      return [
        ...actual,
        {
          idc,
          nombre: nombreInicial,
        },
      ];
    });

    setPestanaActiva(idc);
  }

  function actualizarNombrePestana(idc: string, nombreReal: string) {
    setPestanas((actual) =>
      actual.map((p) =>
        p.idc === idc
          ? {
              ...p,
              nombre: nombreReal,
            }
          : p,
      ),
    );
  }

  function cerrarPestana(idc: string) {
    setPestanas((actual) => {
      const indice = actual.findIndex((p) => p.idc === idc);

      const nuevas = actual.filter((p) => p.idc !== idc);

      if (pestanaActiva === idc) {
        if (nuevas.length === 0) {
          setPestanaActiva("cuentas");
        } else if (indice < nuevas.length) {
          setPestanaActiva(nuevas[indice].idc);
        } else {
          setPestanaActiva(nuevas[nuevas.length - 1].idc);
        }
      }

      return nuevas;
    });
  }

  const cuentasFiltradas = useMemo(() => {
    if (!filtroLista.trim()) {
      return cuentas;
    }

    const texto = filtroLista.toLowerCase();

    return cuentas.filter(
      (c) => c.cliente.toLowerCase().includes(texto) || c.idc.includes(texto),
    );
  }, [cuentas, filtroLista]);

  if (verificandoRol) {
    return null;
  }

  const iniciales = sesion ? obtenerIniciales(sesion.nombreCompleto) : "";

  return (
    <main
      className="tema-gestor min-h-screen"
      style={{
        background: "var(--color-fondo)",
      }}
    >
      <div
        className="px-4 sm:px-6 py-3.5 sm:py-4"
        style={{
          background: "var(--color-superficie)",
          boxShadow: "var(--sombra-sm)",
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h1
              className="text-lg font-semibold truncate"
              style={{
                color: "var(--color-texto)",
              }}
            >
              Gestión de Oficina
            </h1>

            <p
              className="text-sm truncate"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Búsqueda de cuentas — Estudio Caillaux
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
            {sesion && (
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
                  style={{
                    background: "var(--color-accion)",
                    color: "white",
                  }}
                >
                  {iniciales}
                </div>

                <span
                  className="text-sm hidden sm:inline truncate max-w-[180px]"
                  style={{
                    color: "var(--color-texto)",
                  }}
                >
                  {sesion.nombreCompleto}
                </span>
              </div>
            )}

            {sesion?.rol === "supervisor" && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="flex items-center justify-center gap-1.5 min-h-9 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
                style={{
                  color: "var(--color-texto-suave)",
                }}
                title="Panel de Administración"
              >
                <LayoutDashboard size={14} />

                <span className="hidden sm:inline">
                  Panel de Administración
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={cerrarSesion}
              className="flex items-center justify-center gap-1.5 min-h-9 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
              style={{
                color: "var(--color-texto-suave)",
              }}
              title="Cerrar sesión"
            >
              <LogOut size={14} />

              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className="overflow-x-auto overscroll-x-contain"
        style={{
          background: "var(--color-fondo-sutil)",
          borderBottom: "1px solid var(--color-borde)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="max-w-6xl w-full mx-auto flex min-w-max">
          <Pestana
            activa={pestanaActiva === "cuentas"}
            etiqueta="Cuentas"
            onClick={() => setPestanaActiva("cuentas")}
          />

          <AnimatePresence initial={false} mode="popLayout">
            {pestanas.map((p) => (
              <Pestana
                key={p.idc}
                activa={pestanaActiva === p.idc}
                etiqueta={p.nombre}
                onClick={() => setPestanaActiva(p.idc)}
                onCerrar={() => cerrarPestana(p.idc)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className={pestanaActiva === "cuentas" ? "block" : "hidden"}>
        <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
          <div className="w-full max-w-2xl">
            <BuscadorInput onBuscar={buscar} />
          </div>

          {cargando && (
            <motion.div
              key="cargando"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              transition={{
                duration: 0.15,
              }}
              className="flex items-center gap-2 mt-4 text-sm"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              <Search size={14} className="animate-pulse" />
              Buscando...
            </motion.div>
          )}

          <AnimatePresence initial={false} mode="wait">
            {!cargando && ultimaBusqueda && (
              <motion.div
                key="resultados"
                initial={{
                  opacity: 0,
                  y: 6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -4,
                }}
                transition={{
                  duration: 0.18,
                }}
                className="tarjeta mt-4 p-3 sm:p-4"
              >
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: ICONO_CUENTA,
                      }}
                    >
                      <Building2
                        size={16}
                        style={{
                          color: "white",
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-xs font-medium"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        Cuentas
                      </p>

                      <div className="flex items-center gap-1 min-w-0">
                        <h2
                          className="text-lg font-bold leading-none truncate"
                          style={{
                            color: "var(--color-texto)",
                          }}
                        >
                          Resultados
                        </h2>

                        <ChevronDown
                          size={14}
                          className="shrink-0"
                          style={{
                            color: "var(--color-texto-tenue)",
                          }}
                        />

                        <Pin
                          size={12}
                          className="ml-1 shrink-0"
                          style={{
                            color: "var(--color-texto-tenue)",
                          }}
                        />
                      </div>

                      <p
                        className="text-xs mt-1"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        {cuentas.length}{" "}
                        {cuentas.length === 1 ? "elemento" : "elementos"} · Se
                        actualizó hace unos segundos
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="w-full sm:w-auto">
                      <button
                        type="button"
                        className="w-full sm:w-auto min-h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-[var(--color-accion-suave)] focus-visible:outline-none"
                        style={{
                          border: "1px solid var(--color-borde-fuerte)",
                          color: "var(--color-accion)",
                          background: "var(--color-superficie)",
                        }}
                      >
                        Vista de inteligencia
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative w-full sm:w-64 lg:w-72">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{
                            color: "var(--color-texto-tenue)",
                          }}
                        />

                        <input
                          type="text"
                          value={filtroLista}
                          onChange={(e) => setFiltroLista(e.target.value)}
                          placeholder="Buscar en esta lista..."
                          className="input-estandar min-h-10 pr-3"
                          style={{
                            paddingLeft: "2.75rem",
                          }}
                          aria-label="Buscar en esta lista"
                        />
                      </div>

                      <div className="flex items-center w-full sm:w-auto rounded-md overflow-hidden border border-[var(--color-borde-fuerte)] bg-[var(--color-superficie)]">
                        <button
                          type="button"
                          disabled
                          className="flex-1 sm:flex-none min-h-10 px-3 flex items-center justify-center"
                          style={{
                            borderRight: "1px solid var(--color-borde)",
                            color: "var(--color-texto-tenue)",
                            opacity: 0.6,
                            cursor: "not-allowed",
                          }}
                          title="Configuración no disponible"
                          aria-label="Configuración no disponible"
                        >
                          <Settings size={15} />
                        </button>

                        <button
                          type="button"
                          disabled
                          className="flex-1 sm:flex-none min-h-10 px-3 flex items-center justify-center gap-0.5"
                          style={{
                            borderRight: "1px solid var(--color-borde)",
                            color: "var(--color-texto-tenue)",
                            opacity: 0.6,
                            cursor: "not-allowed",
                          }}
                          title="Columnas no disponibles"
                          aria-label="Columnas no disponibles"
                        >
                          <Columns3 size={15} />

                          <ChevronDown size={10} />
                        </button>

                        <button
                          type="button"
                          onClick={refrescar}
                          className="flex-1 sm:flex-none min-h-10 px-3 flex items-center justify-center transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
                          style={{
                            borderRight: "1px solid var(--color-borde)",
                            color: "var(--color-texto-suave)",
                          }}
                          title="Actualizar"
                          aria-label="Actualizar resultados"
                        >
                          <RotateCw size={15} />
                        </button>

                        <button
                          type="button"
                          disabled
                          className="flex-1 sm:flex-none min-h-10 px-3 flex items-center justify-center"
                          style={{
                            color: "var(--color-texto-tenue)",
                            opacity: 0.6,
                            cursor: "not-allowed",
                          }}
                          title="Filtro no disponible"
                          aria-label="Filtro no disponible"
                        >
                          <Filter size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <TablaResultados
                  cuentas={cuentasFiltradas}
                  onAbrirCliente={abrirCliente}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {pestanas.map((p) => (
        <div
          key={p.idc}
          className={pestanaActiva === p.idc ? "block" : "hidden"}
        >
          <FichaCliente
            idc={p.idc}
            onNombreCliente={(nombre) => actualizarNombrePestana(p.idc, nombre)}
          />
        </div>
      ))}
    </main>
  );
}
