// components/BuscadorInput.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";

const CLAVE_BUSQUEDAS_RECIENTES = "buscador_gestor_recientes";
const MAX_RECIENTES = 5;

export default function BuscadorInput({
  onBuscar,
}: {
  onBuscar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enfocado, setEnfocado] = useState(false);
  const [recientes, setRecientes] = useState<string[]>([]);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const guardadas = localStorage.getItem(CLAVE_BUSQUEDAS_RECIENTES);
    if (guardadas) setRecientes(JSON.parse(guardadas));
  }, []);

  useEffect(() => {
    function alHacerClicAfuera(e: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target as Node)
      ) {
        setEnfocado(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicAfuera);
    return () => document.removeEventListener("mousedown", alHacerClicAfuera);
  }, []);

  function guardarReciente(valor: string) {
    setRecientes((actual) => {
      const nuevas = [valor, ...actual.filter((t) => t !== valor)].slice(
        0,
        MAX_RECIENTES,
      );
      localStorage.setItem(CLAVE_BUSQUEDAS_RECIENTES, JSON.stringify(nuevas));
      return nuevas;
    });
  }

  function ejecutarBusqueda(valor: string) {
    if (!valor.trim()) return;
    onBuscar(valor);
    guardarReciente(valor);
    setTexto(valor);
    setEnfocado(false);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <div
        className="flex items-center rounded overflow-hidden transition-shadow"
        style={{
          border: `1px solid ${enfocado ? "var(--color-accion)" : "var(--color-borde-fuerte)"}`,
          boxShadow: enfocado ? "var(--sombra-focus)" : "none",
          background: "white",
        }}
      >
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium shrink-0"
          style={{
            background: "var(--color-fondo-sutil)",
            borderRight: "1px solid var(--color-borde)",
            color: "var(--color-texto-suave)",
          }}
        >
          Buscar: Todo
          <ChevronDown size={12} />
        </button>

        <div className="flex-1 flex items-center px-2.5">
          <Search
            size={15}
            style={{ color: "var(--color-texto-tenue)" }}
            className="shrink-0 mr-2"
          />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ejecutarBusqueda(texto);
            }}
            placeholder="Buscar..."
            className="w-full py-2 text-sm outline-none"
            style={{ color: "var(--color-texto)" }}
          />
        </div>
      </div>

      {enfocado && recientes.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded z-40 overflow-hidden"
          style={{
            background: "white",
            border: "1px solid var(--color-borde)",
            boxShadow: "var(--sombra-lg)",
          }}
        >
          <div className="py-1.5">
            {recientes.map((r) => (
              <button
                key={r}
                onClick={() => ejecutarBusqueda(r)}
                className="w-full flex items-center gap-3 px-4 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--color-texto)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--color-fondo-sutil)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <Search
                  size={14}
                  style={{ color: "var(--color-texto-tenue)" }}
                  className="shrink-0"
                />
                <span className="truncate">{r}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
