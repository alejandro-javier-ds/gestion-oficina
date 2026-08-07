// app/cambiar-contrasena/page.tsx
// Pantalla de cambio de contraseña obligatorio.
// coincidencia en vivo, indicador de fortaleza, checklist en vivo,
// botón deshabilitado hasta cumplir todo.

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PiEyeFill, PiEyeClosedFill } from "react-icons/pi";

type Requisito = { cumple: boolean; etiqueta: string };

function evaluarRequisitos(contrasena: string): Requisito[] {
  return [
    { cumple: contrasena.length >= 8, etiqueta: "Al menos 8 caracteres" },
    { cumple: /[a-z]/.test(contrasena), etiqueta: "Al menos una minúscula" },
    { cumple: /[A-Z]/.test(contrasena), etiqueta: "Al menos una mayúscula" },
    { cumple: /[0-9]/.test(contrasena), etiqueta: "Al menos un número" },
  ];
}

function calcularFortaleza(
  contrasena: string,
  requisitos: Requisito[],
): { texto: string; color: string; porcentaje: number } {
  const requisitosCumplidos = requisitos.filter((r) => r.cumple).length;
  const tieneSimbolo = /[^a-zA-Z0-9]/.test(contrasena);

  let puntaje = requisitosCumplidos;
  if (tieneSimbolo) puntaje += 1;

  if (contrasena.length === 0)
    return { texto: "", color: "transparent", porcentaje: 0 };
  if (puntaje <= 2) return { texto: "Débil", color: "#b91c1c", porcentaje: 33 };
  if (puntaje <= 4) return { texto: "Media", color: "#b45309", porcentaje: 66 };
  return { texto: "Fuerte", color: "#15803d", porcentaje: 100 };
}

export default function CambiarContrasenaPage() {
  const router = useRouter();
  const [contrasenaNueva, setContrasenaNueva] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const requisitos = useMemo(
    () => evaluarRequisitos(contrasenaNueva),
    [contrasenaNueva],
  );
  const fortaleza = useMemo(
    () => calcularFortaleza(contrasenaNueva, requisitos),
    [contrasenaNueva, requisitos],
  );

  const todosLosRequisitosCumplidos = requisitos.every((r) => r.cumple);
  const contrasenasCoinciden =
    confirmarContrasena.length > 0 && contrasenaNueva === confirmarContrasena;
  const puedeGuardar = todosLosRequisitosCumplidos && contrasenasCoinciden;

  async function guardarContrasena(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!puedeGuardar) return;

    setCargando(true);

    const res = await fetch("/api/cambiar-contrasena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contrasenaNueva }),
    });

    setCargando(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Ocurrió un error al cambiar la contraseña.");
      return;
    }

    setExito(true);
  }

  async function irAlLogin() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (exito) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--color-fondo)" }}
      >
        <div
          className="w-full max-w-sm rounded border p-6 text-center"
          style={{
            borderColor: "var(--color-borde)",
            background: "var(--color-superficie)",
          }}
        >
          <h1 className="text-lg font-semibold mb-2">Contraseña actualizada</h1>
          <p
            className="text-sm mb-5"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Ahora ingresa de nuevo con tu nueva contraseña.
          </p>
          <button
            onClick={irAlLogin}
            className="w-full text-white py-2 rounded font-medium"
            style={{ background: "var(--color-accion)" }}
          >
            Ir al inicio de sesión
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-fondo)" }}
    >
      <div
        className="w-full max-w-sm rounded border p-6"
        style={{
          borderColor: "var(--color-borde)",
          background: "var(--color-superficie)",
        }}
      >
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center font-semibold text-lg text-white mb-3"
            style={{ background: "var(--color-marca)" }}
          >
            GO
          </div>
          <h1 className="text-lg font-semibold">Crea tu nueva contraseña</h1>
          <p className="text-sm" style={{ color: "var(--color-texto-suave)" }}>
            Por seguridad, debes definir una contraseña propia antes de
            continuar.
          </p>
        </div>

        <form onSubmit={guardarContrasena} className="space-y-4">
          <div>
            <label
              className="text-sm block mb-1"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={mostrarContrasena ? "text" : "password"}
                value={contrasenaNueva}
                onChange={(e) => setContrasenaNueva(e.target.value)}
                autoFocus
                className="border rounded px-3 py-2 w-full pr-10"
                style={{ borderColor: "var(--color-borde)" }}
                required
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                style={{ color: "var(--color-texto)" }}
                tabIndex={-1}
                aria-label={
                  mostrarContrasena
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                {mostrarContrasena ? (
                  <PiEyeClosedFill size={20} />
                ) : (
                  <PiEyeFill size={20} />
                )}
              </button>
            </div>

            {contrasenaNueva.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 rounded bg-gray-200 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${fortaleza.porcentaje}%`,
                      background: fortaleza.color,
                    }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: fortaleza.color }}>
                  Fortaleza: {fortaleza.texto}
                </p>
              </div>
            )}

            <ul className="mt-2 space-y-0.5">
              {requisitos.map((req) => (
                <li
                  key={req.etiqueta}
                  className="text-xs flex items-center gap-1.5"
                  style={{
                    color: req.cumple ? "#15803d" : "var(--color-texto-suave)",
                  }}
                >
                  <span>{req.cumple ? "✓" : "○"}</span>
                  {req.etiqueta}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label
              className="text-sm block mb-1"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                type={mostrarConfirmacion ? "text" : "password"}
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                className="border rounded px-3 py-2 w-full pr-10"
                style={{ borderColor: "var(--color-borde)" }}
                required
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmacion((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                style={{ color: "var(--color-texto)" }}
                tabIndex={-1}
                aria-label={
                  mostrarConfirmacion
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                {mostrarConfirmacion ? (
                  <PiEyeClosedFill size={20} />
                ) : (
                  <PiEyeFill size={20} />
                )}
              </button>
            </div>

            {confirmarContrasena.length > 0 && (
              <p
                className="text-xs mt-1"
                style={{ color: contrasenasCoinciden ? "#15803d" : "#b91c1c" }}
              >
                {contrasenasCoinciden
                  ? "✓ Las contraseñas coinciden"
                  : "✗ Las contraseñas no coinciden"}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!puedeGuardar || cargando}
            className="w-full text-white py-2 rounded font-medium disabled:opacity-50"
            style={{ background: "var(--color-accion)" }}
          >
            {cargando ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
