// app/elegir-modo/page.tsx
// Pantalla exclusiva para el rol Supervisor — el único rol con
// acceso a las 2 experiencias del sistema (gestionar clientes con
// cartera completa, o el Panel de Administración de solo consulta).
// Aparece justo después del login; desde acá elige a dónde entrar.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, LayoutDashboard } from "lucide-react";

type Sesion = {
  nombreCompleto: string;
  rol: "administrador" | "supervisor" | "abogado" | "gestor";
};

export default function ElegirModoPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    fetch("/api/sesion")
      .then((res) => res.json())
      .then((data) => {
        if (!data.sesion) {
          router.replace("/login");
          return;
        }
        if (data.sesion.rol !== "supervisor") {
          router.replace(data.sesion.rol === "gestor" ? "/" : "/admin");
          return;
        }
        setSesion(data.sesion);
        setVerificando(false);
      });
  }, [router]);

  if (verificando || !sesion) {
    return null;
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-fondo)" }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--color-texto)" }}
          >
            Hola, {sesion.nombreCompleto.split(" ")[0]}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-texto-suave)" }}
          >
            ¿A dónde quieres entrar?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-left p-6 rounded-lg transition-all"
            style={{
              background: "var(--color-superficie)",
              boxShadow: "var(--sombra-md)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow = "var(--sombra-lg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.boxShadow = "var(--sombra-md)")
            }
          >
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center mb-3"
              style={{
                background: "var(--color-accion-suave)",
                color: "var(--color-accion)",
              }}
            >
              <Users size={20} />
            </div>
            <p
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Gestionar clientes
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Cartera completa, sin restricción — registra gestiones y promesas
              de pago.
            </p>
          </button>

          <button
            onClick={() => router.push("/admin")}
            className="text-left p-6 rounded-lg transition-all"
            style={{
              background: "var(--color-superficie)",
              boxShadow: "var(--sombra-md)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow = "var(--sombra-lg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.boxShadow = "var(--sombra-md)")
            }
          >
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center mb-3"
              style={{
                background: "var(--color-accion-suave)",
                color: "var(--color-accion)",
              }}
            >
              <LayoutDashboard size={20} />
            </div>
            <p
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Panel de Administración
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Dashboard, exportar, subir portafolio — solo consulta.
            </p>
          </button>
        </div>
      </div>
    </main>
  );
}
