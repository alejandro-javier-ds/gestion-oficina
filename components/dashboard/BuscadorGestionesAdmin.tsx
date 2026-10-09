// components/dashboard/BuscadorGestionesAdmin.tsx
// Buscador de gestiones por cliente/IDC. Editar/Eliminar

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Pencil, Trash2 } from "lucide-react";
import ModalEditarGestion, { GestionParaEditar } from "../ModalEditarGestion";

type Resultado = {
  id: number;
  idc: string;
  cliente: string | null;
  codcuentacobranza: string | null;
  usuario_gestor_oficina: string;
  categoria: string | null;
  codigo_razon: string | null;
  fecha_hora: string;
  monto_pagado: number | null;
  observacion: string | null;
};

const CHIP_POR_CATEGORIA: Record<string, string> = {
  TAT: "chip-exito",
  MCT: "chip-accion",
  TIN: "chip-alerta",
  PDP: "chip-accion",
  OTRAS: "chip-neutral",
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return fecha.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BuscadorGestionesAdmin() {
  const [rolPermitido, setRolPermitido] = useState<boolean | null>(null);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscoAlgunaVez, setBuscoAlgunaVez] = useState(false);
  const [gestionEditando, setGestionEditando] =
    useState<GestionParaEditar | null>(null);

  useEffect(() => {
    fetch("/api/sesion")
      .then((res) => res.json())
      .then((data) =>
        setRolPermitido(
          data.sesion?.rol === "administrador" ||
            data.sesion?.rol === "supervisor",
        ),
      );
  }, []);

  async function buscar(q: string) {
    setTexto(q);
    if (q.trim().length < 2) {
      setResultados([]);
      setBuscoAlgunaVez(false);
      return;
    }
    setBuscando(true);
    setBuscoAlgunaVez(true);
    const res = await fetch(
      `/api/admin/gestiones-buscar?q=${encodeURIComponent(q)}`,
    );
    const data = await res.json();
    setResultados(data.resultados ?? []);
    setBuscando(false);
  }

  function recargarBusqueda() {
    if (texto.trim().length >= 2) buscar(texto);
  }

  function abrirEdicion(r: Resultado) {
    setGestionEditando({
      id: r.id,
      cliente: r.cliente,
      usuario_gestor_oficina: r.usuario_gestor_oficina,
      categoria: r.categoria,
      codigo_razon: r.codigo_razon,
      fecha_hora: r.fecha_hora,
      monto_pagado: r.monto_pagado,
      observacion: r.observacion,
    });
  }

  function alGuardar() {
    setGestionEditando(null);
    recargarBusqueda();
  }

  if (rolPermitido === null || rolPermitido === false) {
    return null;
  }

  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium mb-3"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Buscar gestión para corregir o eliminar
      </p>

      <div className="relative mb-3">
        <Search
          size={15}
          className="absolute pointer-events-none"
          style={{
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-texto-tenue)",
          }}
        />
        <input
          type="text"
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Buscar por nombre de cliente o IDC..."
          className="w-full py-2 rounded text-sm"
          style={{
            border: "1px solid var(--color-borde-fuerte)",
            paddingLeft: 38,
            paddingRight: 12,
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {buscando && (
          <motion.p
            key="buscando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Buscando...
          </motion.p>
        )}

        {!buscando && buscoAlgunaVez && resultados.length === 0 && (
          <motion.p
            key="vacio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Sin resultados para &quot;{texto}&quot;.
          </motion.p>
        )}

        {!buscando && resultados.length > 0 && (
          <motion.div
            key="resultados"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 max-h-96 overflow-y-auto"
          >
            {resultados.map((r) => (
              <div
                key={r.id}
                className="border-l-2 pl-3 py-1.5"
                style={{ borderColor: "var(--color-accion)" }}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.cliente ?? "—"}
                    </p>
                    <p
                      className="text-xs dato-numerico"
                      style={{ color: "var(--color-texto-suave)" }}
                    >
                      IDC {r.idc} · {r.usuario_gestor_oficina}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.categoria && (
                      <span
                        className={`chip ${CHIP_POR_CATEGORIA[r.categoria] ?? "chip-neutral"}`}
                      >
                        {r.categoria}
                      </span>
                    )}
                    <button
                      onClick={() => abrirEdicion(r)}
                      className="p-1 rounded hover:bg-gray-100"
                      title="Editar"
                      style={{ color: "var(--color-texto-suave)" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => abrirEdicion(r)}
                      className="p-1 rounded hover:bg-gray-100"
                      title="Editar o eliminar"
                      style={{ color: "#b91c1c" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-baseline mt-0.5 gap-2">
                  <span className="text-sm">{r.codigo_razon}</span>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    {formatearFecha(r.fecha_hora)}
                  </span>
                </div>
                {r.observacion && (
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    {r.observacion}
                  </p>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <ModalEditarGestion
        gestion={gestionEditando}
        onCerrar={() => setGestionEditando(null)}
        onGuardado={alGuardar}
      />
    </div>
  );
}
