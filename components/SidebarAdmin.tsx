// components/SidebarAdmin.tsx
// Sidebar del Panel Admin.

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import {
  LayoutDashboard,
  FileSpreadsheet,
  Upload,
  Users,
  Search,
  LogOut,
  Menu,
  X,
  Briefcase,
  Database,
  MessageCircle,
} from "lucide-react";

type ItemMenu = {
  etiqueta: string;
  ruta: string;
  icono: React.ReactNode;
  rolesPermitidos?: string[];
};

const ITEMS: ItemMenu[] = [
  {
    etiqueta: "Dashboard",
    ruta: "/admin",
    icono: <LayoutDashboard size={18} />,
  },
  {
    etiqueta: "Exportar",
    ruta: "/admin/exportar",
    icono: <FileSpreadsheet size={18} />,
  },
  {
    etiqueta: "Subir Portafolio",
    ruta: "/admin/portafolio",
    icono: <Upload size={18} />,
  },
  {
    etiqueta: "Usuarios",
    ruta: "/admin/usuarios",
    icono: <Users size={18} />,
    rolesPermitidos: ["administrador"],
  },
  {
    etiqueta: "Backups",
    ruta: "/admin/backups",
    icono: <Database size={18} />,
    rolesPermitidos: ["administrador", "supervisor"],
  },
  {
    etiqueta: "WhatsApp Masivo",
    ruta: "/admin/whatsapp",
    icono: <MessageCircle size={18} />,
    rolesPermitidos: ["administrador", "supervisor"],
  },
];

const ETIQUETAS_ROL: Record<string, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  abogado: "Abogado",
  gestor: "Gestor",
};

function TextoColapsable({
  mostrar,
  children,
}: {
  mostrar: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {mostrar && (
        <motion.span
          initial={{
            opacity: 0,
            width: 0,
          }}
          animate={{
            opacity: 1,
            width: "auto",
          }}
          exit={{
            opacity: 0,
            width: 0,
          }}
          transition={{
            duration: 0.18,
            ease: "easeInOut",
          }}
          className="overflow-hidden whitespace-nowrap"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function SidebarAdmin() {
  const pathname = usePathname();
  const router = useRouter();

  const [colapsado, setColapsado] = useState(false);
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  const [sesion, setSesion] = useState<{
    nombreCompleto: string;
    rol: string;
  } | null>(null);

  useEffect(() => {
    function sincronizarResponsive() {
      const ancho = window.innerWidth;

      if (ancho >= 768 && ancho < 1100) {
        setColapsado(true);
        return;
      }

      if (ancho >= 1100) {
        setColapsado(false);
      }
    }

    sincronizarResponsive();

    window.addEventListener("resize", sincronizarResponsive);

    return () => {
      window.removeEventListener("resize", sincronizarResponsive);
    };
  }, []);

  useEffect(() => {
    fetch("/api/sesion")
      .then((res) => res.json())
      .then((data) => setSesion(data.sesion ?? null))
      .catch(() => {
        setSesion(null);
      });
  }, []);

  useEffect(() => {
    setAbiertoMovil(false);
  }, [pathname]);

  async function cerrarSesion() {
    await fetch("/api/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  const itemsVisibles = ITEMS.filter(
    (item) =>
      !item.rolesPermitidos ||
      (sesion?.rol && item.rolesPermitidos.includes(sesion.rol)),
  );

  const iniciales = sesion?.nombreCompleto
    ? sesion.nombreCompleto
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "";

  function ContenidoSidebar({ mostrarColapsar }: { mostrarColapsar: boolean }) {
    const mostrarTexto = !colapsado || !mostrarColapsar;

    return (
      <>
        <button
          type="button"
          onClick={() => mostrarColapsar && setColapsado((v) => !v)}
          className="px-4 py-5 flex items-center gap-3 w-full text-left shrink-0 transition-colors hover:bg-[var(--color-fondo-sutil)]"
          style={{
            borderBottom: "1px solid var(--color-borde)",
          }}
          title={
            mostrarColapsar ? (colapsado ? "Expandir" : "Contraer") : undefined
          }
          aria-label={
            mostrarColapsar
              ? colapsado
                ? "Expandir menú"
                : "Contraer menú"
              : undefined
          }
          aria-expanded={mostrarColapsar ? !colapsado : undefined}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 transition-transform duration-200"
            style={{
              background: "var(--color-accion)",
              color: "white",
            }}
          >
            {iniciales || "GO"}
          </div>

          {sesion && (
            <TextoColapsable mostrar={mostrarTexto}>
              <div className="min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{
                    color: "var(--color-texto)",
                  }}
                >
                  {sesion.nombreCompleto}
                </p>

                <p
                  className="text-xs"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  {ETIQUETAS_ROL[sesion.rol] ?? sesion.rol}
                </p>
              </div>
            </TextoColapsable>
          )}
        </button>

        {sesion?.rol === "supervisor" && (
          <div
            className="px-2 pt-3 pb-1 shrink-0"
            style={{
              borderBottom: "1px solid var(--color-borde)",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-md text-sm transition-colors mb-2 hover:brightness-[0.98]"
              style={{
                background: "var(--color-accion-suave)",
                color: "var(--color-accion)",
              }}
              title={colapsado ? "Gestionar clientes" : undefined}
            >
              <Briefcase size={18} className="shrink-0" />

              <TextoColapsable mostrar={mostrarTexto}>
                <span className="font-medium">Gestionar clientes</span>
              </TextoColapsable>
            </button>
          </div>
        )}

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {itemsVisibles.map((item) => {
            const activo = pathname === item.ruta;

            return (
              <button
                type="button"
                key={item.ruta}
                onClick={() => router.push(item.ruta)}
                className="w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-md text-sm relative transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
                style={{
                  color: activo
                    ? "var(--color-accion)"
                    : "var(--color-texto-suave)",
                  background: activo
                    ? "var(--color-accion-suave)"
                    : "transparent",
                }}
                title={colapsado && mostrarColapsar ? item.etiqueta : undefined}
                aria-current={activo ? "page" : undefined}
              >
                {activo && (
                  <motion.span
                    initial={{
                      opacity: 0,
                      scaleY: 0.6,
                    }}
                    animate={{
                      opacity: 1,
                      scaleY: 1,
                    }}
                    transition={{
                      duration: 0.15,
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r origin-center"
                    style={{
                      width: "3px",
                      height: "60%",
                      background: "var(--color-accion)",
                    }}
                  />
                )}

                <span className="shrink-0">{item.icono}</span>

                <TextoColapsable mostrar={mostrarTexto}>
                  <span className="font-medium">{item.etiqueta}</span>
                </TextoColapsable>
              </button>
            );
          })}

          <div
            className="pt-2 mt-2"
            style={{
              borderTop: "1px solid var(--color-borde)",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/admin/buscador-admin")}
              className="w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-md text-sm transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
              style={{
                color: "var(--color-texto-suave)",
              }}
              title={
                colapsado && mostrarColapsar ? "Buscar cliente" : undefined
              }
            >
              <Search size={18} className="shrink-0" />

              <TextoColapsable mostrar={mostrarTexto}>
                <span className="font-medium">Buscar cliente</span>
              </TextoColapsable>
            </button>
          </div>
        </nav>

        <div
          className="px-2 pb-4 shrink-0"
          style={{
            borderTop: "1px solid var(--color-borde)",
          }}
        >
          <button
            type="button"
            onClick={cerrarSesion}
            className="w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-md text-sm transition-colors mt-2 hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
            style={{
              color: "var(--color-texto-suave)",
            }}
            title={colapsado && mostrarColapsar ? "Cerrar sesión" : undefined}
          >
            <LogOut size={18} className="shrink-0" />

            <TextoColapsable mostrar={mostrarTexto}>
              <span>Cerrar sesión</span>
            </TextoColapsable>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbiertoMovil(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg flex items-center justify-center transition-transform hover:scale-[1.03] focus-visible:outline-none"
        style={{
          background: "var(--color-superficie)",
          boxShadow: "var(--sombra-md)",
          color: "var(--color-texto)",
        }}
        aria-label="Abrir menú"
        aria-expanded={abiertoMovil}
      >
        <Menu size={20} />
      </button>

      <motion.aside
        className="hidden md:flex flex-col overflow-hidden shrink-0"
        animate={{
          width: colapsado ? 68 : 240,
        }}
        transition={{
          duration: 0.22,
          ease: [0.4, 0, 0.2, 1],
        }}
        style={{
          background: "var(--color-superficie)",
          boxShadow: "var(--sombra-md)",
          position: "sticky",
          top: 0,
          height: "100vh",
          alignSelf: "flex-start",
        }}
      >
        <ContenidoSidebar mostrarColapsar />
      </motion.aside>

      <AnimatePresence>
        {abiertoMovil && (
          <>
            <motion.div
              className="md:hidden fixed inset-0"
              style={{
                zIndex: "var(--z-overlay)" as unknown as number,
                background: "rgba(0,0,0,0.4)",
              }}
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: 0.15,
              }}
              onClick={() => setAbiertoMovil(false)}
            />

            <motion.aside
              className="md:hidden fixed top-0 left-0 h-screen flex flex-col"
              style={{
                zIndex: "calc(var(--z-overlay) + 10)" as unknown as number,
                width: 260,
                maxWidth: "85vw",
                background: "var(--color-superficie)",
                boxShadow: "var(--sombra-lg)",
              }}
              initial={{
                x: "-100%",
              }}
              animate={{
                x: 0,
              }}
              exit={{
                x: "-100%",
              }}
              transition={{
                duration: 0.22,
                ease: "easeOut",
              }}
            >
              <div className="flex justify-end p-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAbiertoMovil(false)}
                  className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--color-fondo-sutil)] focus-visible:outline-none"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                  aria-label="Cerrar menú"
                >
                  <X size={18} />
                </button>
              </div>

              <ContenidoSidebar mostrarColapsar={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
