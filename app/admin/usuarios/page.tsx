// app/admin/usuarios/page.tsx
// Lista de usuarios con las 8 mejoras existentes (avatares, chips de
// rol, resumen de conteos, estado activo/inactivo, buscador, copiar
// username, orden por jerarquía, contraseña temporal) + responsive
// completo (celular → monitor grande) + Framer Motion en la lista,
// los mensajes de error, y la caja de contraseña temporal.

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Search, Copy, Check, Circle } from "lucide-react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";

type Rol = "administrador" | "supervisor" | "abogado" | "gestor";

type Usuario = {
  id: number;
  username: string;
  nombre_completo: string;
  gestor: string | null;
  rol: Rol;
  activo: number;
};

const ETIQUETAS_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  abogado: "Abogado",
  gestor: "Gestor",
};

const CHIP_POR_ROL: Record<Rol, string> = {
  administrador: "chip-accion",
  supervisor: "chip-exito",
  abogado: "chip-alerta",
  gestor: "chip-neutral",
};

const ORDEN_ROL: Record<Rol, number> = {
  administrador: 0,
  supervisor: 1,
  abogado: 2,
  gestor: 3,
};

function obtenerIniciales(nombreCompleto: string): string {
  return nombreCompleto
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [usernameCopiado, setUsernameCopiado] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [rol, setRol] = useState<Rol>("gestor");
  const [gestor, setGestor] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contrasenaGenerada, setContrasenaGenerada] = useState<string | null>(
    null,
  );

  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  function cargarUsuarios() {
    setCargando(true);
    fetch("/api/admin/usuarios")
      .then((res) => res.json())
      .then((data) => setUsuarios(data.usuarios ?? []))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const usuariosVisibles = useMemo(() => {
    const filtrados = usuarios.filter((u) => {
      const texto = busqueda.trim().toLowerCase();
      if (!texto) return true;
      return (
        u.nombre_completo.toLowerCase().includes(texto) ||
        u.username.toLowerCase().includes(texto)
      );
    });

    return [...filtrados].sort((a, b) => {
      const diferenciaRol = ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol];
      if (diferenciaRol !== 0) return diferenciaRol;
      return a.nombre_completo.localeCompare(b.nombre_completo);
    });
  }, [usuarios, busqueda]);

  const conteos = useMemo(() => {
    const base: Record<Rol, number> = {
      administrador: 0,
      supervisor: 0,
      abogado: 0,
      gestor: 0,
    };
    for (const u of usuarios) base[u.rol]++;
    return base;
  }, [usuarios]);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setContrasenaGenerada(null);
    setCreando(true);

    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        nombreCompleto,
        rol,
        gestor: rol === "gestor" ? gestor : undefined,
      }),
    });

    const data = await res.json();
    setCreando(false);

    if (!res.ok) {
      setError(data.error ?? "Ocurrió un error al crear el usuario.");
      return;
    }

    setContrasenaGenerada(data.contrasenaTemporal);
    setUsername("");
    setNombreCompleto("");
    setGestor("");
    cargarUsuarios();
  }

  async function eliminarUsuario(id: number, nombreCompletoUsuario: string) {
    const confirmado = window.confirm(
      `¿Seguro que quieres eliminar a ${nombreCompletoUsuario}? Esta acción no se puede deshacer.`,
    );
    if (!confirmado) return;

    setErrorEliminar(null);
    setEliminandoId(id);

    const res = await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    const data = await res.json();

    setEliminandoId(null);

    if (!res.ok) {
      setErrorEliminar(
        data.error ?? "Ocurrió un error al eliminar el usuario.",
      );
      return;
    }

    cargarUsuarios();
  }

  async function copiarUsername(username: string) {
    await navigator.clipboard.writeText(username);
    setUsernameCopiado(username);
    setTimeout(() => setUsernameCopiado(null), 1500);
  }

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <HeaderPanelAdmin
        titulo="Usuarios"
        descripcion="Crea y administra las cuentas de gestores, supervisores, abogados y administradores."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="chip chip-neutral">
          {usuarios.length} usuarios en total
        </span>
        {conteos.administrador > 0 && (
          <span className="chip chip-accion">
            {conteos.administrador} Administrador
            {conteos.administrador !== 1 ? "es" : ""}
          </span>
        )}
        {conteos.supervisor > 0 && (
          <span className="chip chip-exito">
            {conteos.supervisor} Supervisor
            {conteos.supervisor !== 1 ? "es" : ""}
          </span>
        )}
        {conteos.abogado > 0 && (
          <span className="chip chip-alerta">
            {conteos.abogado} Abogado{conteos.abogado !== 1 ? "s" : ""}
          </span>
        )}
        {conteos.gestor > 0 && (
          <span className="chip chip-neutral">
            {conteos.gestor} Gestor{conteos.gestor !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="tarjeta p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Usuarios existentes
            </h2>

            <div className="relative w-full sm:w-auto">
              <Search
                size={15}
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: "10px", color: "var(--color-texto-tenue)" }}
              />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o usuario"
                className="input-estandar text-sm w-full sm:w-[220px]"
                style={{ paddingLeft: "32px" }}
              />
            </div>
          </div>

          <AnimatePresence>
            {errorEliminar && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm overflow-hidden"
                style={{ color: "var(--color-error)" }}
              >
                {errorEliminar}
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {cargando ? (
              <motion.p
                key="cargando"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Cargando...
              </motion.p>
            ) : usuariosVisibles.length === 0 ? (
              <motion.p
                key="vacio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm py-6 text-center"
                style={{ color: "var(--color-texto-suave)" }}
              >
                {busqueda
                  ? "Sin resultados para esa búsqueda."
                  : "No hay usuarios registrados."}
              </motion.p>
            ) : (
              <motion.div
                key="lista"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1"
              >
                {usuariosVisibles.map((u, i) => (
                  <motion.div
                    key={u.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-2 py-2.5 rounded-lg transition-colors"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--color-fondo-sutil)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
                      style={{
                        background: "var(--color-marca)",
                        color: "white",
                      }}
                    >
                      {obtenerIniciales(u.nombre_completo)}
                    </div>

                    <div className="min-w-0 flex-1 basis-[140px]">
                      <div className="flex items-center gap-1.5">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--color-texto)" }}
                        >
                          {u.nombre_completo}
                        </p>
                        <Circle
                          size={7}
                          fill={
                            u.activo
                              ? "var(--color-exito)"
                              : "var(--color-texto-tenue)"
                          }
                          style={{ color: "transparent", flexShrink: 0 }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs dato-numerico"
                          style={{ color: "var(--color-texto-suave)" }}
                        >
                          {u.username}
                        </span>
                        <button
                          onClick={() => copiarUsername(u.username)}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                          title="Copiar usuario"
                        >
                          {usernameCopiado === u.username ? (
                            <Check
                              size={12}
                              style={{ color: "var(--color-exito)" }}
                            />
                          ) : (
                            <Copy
                              size={12}
                              style={{ color: "var(--color-texto-suave)" }}
                            />
                          )}
                        </button>
                      </div>
                    </div>

                    <span className={`chip ${CHIP_POR_ROL[u.rol]} shrink-0`}>
                      {ETIQUETAS_ROL[u.rol]}
                    </span>

                    {u.gestor && (
                      <span
                        className="text-xs hidden xl:block shrink-0"
                        style={{ color: "var(--color-texto-suave)" }}
                      >
                        {u.gestor}
                      </span>
                    )}

                    <div
                      className="shrink-0 ml-auto sm:ml-0"
                      style={{ width: "56px" }}
                    >
                      {u.rol !== "administrador" && (
                        <button
                          onClick={() =>
                            eliminarUsuario(u.id, u.nombre_completo)
                          }
                          disabled={eliminandoId === u.id}
                          className="text-xs font-medium disabled:opacity-50"
                          style={{ color: "var(--color-error)" }}
                        >
                          {eliminandoId === u.id ? "..." : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="tarjeta p-4 sm:p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} style={{ color: "var(--color-accion)" }} />
            <h2
              className="font-semibold"
              style={{ color: "var(--color-texto)" }}
            >
              Crear nuevo usuario
            </h2>
          </div>

          <form onSubmit={crearUsuario} className="space-y-3">
            <div>
              <label
                className="text-xs font-medium uppercase tracking-wide block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Nombre completo
              </label>
              <input
                type="text"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                className="input-estandar w-full text-sm"
                required
              />
            </div>

            <div>
              <label
                className="text-xs font-medium uppercase tracking-wide block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-estandar w-full text-sm"
                required
              />
            </div>

            <div>
              <label
                className="text-xs font-medium uppercase tracking-wide block mb-1.5"
                style={{ color: "var(--color-texto-suave)" }}
              >
                Rol
              </label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className="input-estandar w-full text-sm"
              >
                <option value="gestor">Gestor</option>
                <option value="abogado">Abogado</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>

            <AnimatePresence>
              {rol === "gestor" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <label
                    className="text-xs font-medium uppercase tracking-wide block mb-1.5"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    Gestor de cartera (exacto como en el portafolio)
                  </label>
                  <input
                    type="text"
                    value={gestor}
                    onChange={(e) => setGestor(e.target.value)}
                    className="input-estandar w-full text-sm"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm overflow-hidden"
                  style={{ color: "var(--color-error)" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={creando}
              className="boton-primario w-full flex items-center justify-center gap-2"
            >
              <UserPlus size={15} />
              {creando ? "Creando..." : "Crear usuario"}
            </button>
          </form>

          <AnimatePresence>
            {contrasenaGenerada && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="mt-4 p-3 rounded-lg overflow-hidden"
                style={{ background: "var(--color-alerta-suave)" }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--color-alerta)" }}
                >
                  Usuario creado — contraseña temporal
                </p>
                <p
                  className="text-lg font-bold dato-numerico mt-1 break-all"
                  style={{ color: "var(--color-alerta)" }}
                >
                  {contrasenaGenerada}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--color-alerta)" }}
                >
                  Compártela con el usuario — no se volverá a mostrar. Deberá
                  cambiarla en su primer inicio de sesión.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
