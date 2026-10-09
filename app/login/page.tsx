// app/login/page.tsx
// Pantalla de inicio de sesión.
// Logo: imagen real del Estudio

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, contrasena }),
    });

    if (!res.ok) {
      setCargando(false);
      const data = await res.json();
      setError(data.error ?? "Ocurrió un error al iniciar sesión.");
      return;
    }

    const data = await res.json();
    setCargando(false);

    if (data.rol === "administrador" || data.rol === "abogado") {
      router.push("/admin");
    } else if (data.rol === "supervisor") {
      router.push("/elegir-modo");
    } else {
      router.push("/");
    }
    router.refresh();
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
            className="rounded-lg mx-auto mb-3 flex items-center justify-center"
            style={{ background: "#0A0F0C", width: 130, padding: "10px 8px" }}
          >
            <img
              src="/img/logo-caillaux.png"
              alt="Estudio Caillaux"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <h1 className="text-lg font-semibold">Gestión de Oficina</h1>
          <p className="text-sm" style={{ color: "var(--color-texto-suave)" }}>
            Estudio Caillaux
          </p>
        </div>

        <form onSubmit={iniciarSesion} className="space-y-4">
          <div>
            <label
              className="text-sm block mb-1"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="border rounded px-3 py-2 w-full"
              style={{ borderColor: "var(--color-borde)" }}
              required
            />
          </div>

          <div>
            <label
              className="text-sm block mb-1"
              style={{ color: "var(--color-texto-suave)" }}
            >
              Contraseña
            </label>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type={mostrarContrasena ? "text" : "password"}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="border rounded w-full"
                style={{
                  borderColor: "var(--color-borde)",
                  padding: "8px 40px 8px 12px",
                }}
                required
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  color: "var(--color-texto-suave)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
                tabIndex={-1}
                aria-label={
                  mostrarContrasena
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                {mostrarContrasena ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full text-white py-2 rounded font-medium disabled:opacity-50"
            style={{ background: "var(--color-accion)" }}
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
