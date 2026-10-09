// components/whatsapp/SelectorNumeroSalida.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

import { CheckCircle2, Loader2, Phone, UserRound, X } from "lucide-react";

type PropietarioTipo = "gestor" | "supervisor" | "independiente";

type EstadoConexion =
  | "conectado"
  | "no_vinculado"
  | "desconectado"
  | "conectando"
  | "error";

type NumeroWhatsapp = {
  id: number;
  numero: string;
  propietario: string;
  propietarioTipo: PropietarioTipo;
  activo: number;
  principal: number;
  fechaCreacion: string;
  iniciado: boolean;
  conectado: boolean;
  qrVisible: boolean;
  paginaAbierta: boolean;
  temporal: boolean;
  estado: EstadoConexion;
  mensaje: string;
};

type EstadoSesion = {
  numero: string;
  iniciado: boolean;
  conectado: boolean;
  qrVisible: boolean;
  paginaAbierta: boolean;
  temporal: boolean;
  estado: EstadoConexion;
  mensaje: string;
};

type Props = {
  valor: string;

  onChange: (valor: string) => void;

  onPropietarioChange?: (propietario: string) => void;
};

type Propietario = {
  nombre: string;
  tipo: PropietarioTipo;
};

const PROPIETARIOS: Propietario[] = [
  {
    nombre: "Geraldine Salazar",

    tipo: "gestor",
  },

  {
    nombre: "Glycel Lozada",

    tipo: "gestor",
  },

  {
    nombre: "Gonzalo Barrientos",

    tipo: "gestor",
  },

  {
    nombre: "Miguel Rodriguez",

    tipo: "supervisor",
  },

  {
    nombre: "Independiente",

    tipo: "independiente",
  },
];

function normalizarNumero(valor: string): string {
  return valor.replace(/\D/g, "").replace(/^51/, "").slice(0, 9);
}

function esCelularValido(valor: string): boolean {
  return /^9\d{8}$/.test(valor);
}

function formatearNumero(numero: string): string {
  return `+51 ${numero}`;
}

function propietarioEtiqueta(propietario: Propietario): string {
  if (propietario.tipo === "gestor") {
    return `${propietario.nombre} (Gestor)`;
  }

  if (propietario.tipo === "supervisor") {
    return `${propietario.nombre} (Supervisor)`;
  }

  return "Independiente (Independiente)";
}

function obtenerVisualEstado(estado: EstadoConexion) {
  switch (estado) {
    case "conectado":
      return {
        texto: "Conectado",

        color: "var(--color-exito)",

        background: "var(--color-exito-suave)",
      };

    case "no_vinculado":
      return {
        texto: "No vinculado",

        color: "var(--color-texto-suave)",

        background: "var(--color-fondo-sutil)",
      };

    case "desconectado":
      return {
        texto: "Disponible",

        color: "var(--color-alerta)",

        background: "var(--color-alerta-suave)",
      };

    case "conectando":
      return {
        texto: "Conectando...",

        color: "var(--color-accion)",

        background: "var(--color-accion-suave)",
      };

    case "error":
      return {
        texto: "Error",

        color: "var(--color-alerta)",

        background: "var(--color-alerta-suave)",
      };
  }
}

export default function SelectorNumeroSalida({
  valor,
  onChange,
  onPropietarioChange,
}: Props) {
  const [numeros, setNumeros] = useState<NumeroWhatsapp[]>([]);

  const [cargandoNumeros, setCargandoNumeros] = useState(true);

  const [error, setError] = useState("");

  const [abiertoManual, setAbiertoManual] = useState(false);

  const [numeroManual, setNumeroManual] = useState("");

  const [propietario, setPropietario] = useState("Independiente");

  const [procesando, setProcesando] = useState(false);

  const [estadoSesion, setEstadoSesion] = useState<EstadoSesion | null>(null);

  const [numeroTemporal, setNumeroTemporal] = useState<string | null>(null);

  const [mostrandoEstado, setMostrandoEstado] = useState(false);

  async function cargarEstados() {
    setCargandoNumeros(true);

    setError("");

    try {
      const response = await fetch("/api/whatsapp/playwright/estados", {
        cache: "no-store",
      });

      const data = (await response.json()) as {
        numeros?: NumeroWhatsapp[];

        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los estados.");
      }

      setNumeros(data.numeros ?? []);

      if (valor) {
        const seleccionado = (data.numeros ?? []).find(
          (item) => item.numero === valor,
        );

        if (seleccionado) {
          setEstadoSesion(seleccionado);
        }
      }
    } catch (errorCarga) {
      console.error("Error cargando estados de WhatsApp:", errorCarga);

      setError(
        errorCarga instanceof Error
          ? errorCarga.message
          : "No se pudieron cargar los estados.",
      );
    } finally {
      setCargandoNumeros(false);
    }
  }

  useEffect(() => {
    void cargarEstados();

    const intervalo = window.setInterval(() => {
      void cargarEstados();
    }, 10_000);

    return () => window.clearInterval(intervalo);
  }, []);

  const numeroSeleccionado = useMemo(
    () => numeros.find((item) => item.numero === valor) ?? null,
    [numeros, valor],
  );

  function seleccionarNumero(numero: string) {
    setError("");

    setNumeroTemporal(null);

    setMostrandoEstado(false);

    onChange(numero);

    const encontrado = numeros.find((item) => item.numero === numero);

    onPropietarioChange?.(encontrado?.propietario ?? "");

    setEstadoSesion(encontrado ?? null);
  }

  function abrirManual() {
    setError("");

    setNumeroManual("");

    setPropietario("Independiente");

    setAbiertoManual(true);
  }

  function cerrarManual() {
    if (procesando) {
      return;
    }

    setAbiertoManual(false);

    setNumeroManual("");

    setError("");
  }

  function propietarioSeleccionado(): Propietario {
    return (
      PROPIETARIOS.find((item) => item.nombre === propietario) ??
      PROPIETARIOS[PROPIETARIOS.length - 1]
    );
  }

  async function iniciarSesionPlaywright(
    numero: string,
    temporal: boolean,
  ): Promise<EstadoSesion> {
    const response = await fetch("/api/whatsapp/playwright/iniciar", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        numero,
        temporal,
      }),
    });

    const data = (await response.json()) as EstadoSesion & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "No se pudo iniciar WhatsApp Web.");
    }

    return data;
  }

  async function registrarYUsar() {
    const numero = normalizarNumero(numeroManual);

    if (!esCelularValido(numero)) {
      setError("Ingresa un celular peruano válido de 9 dígitos.");

      return;
    }

    const propietarioActual = propietarioSeleccionado();

    setProcesando(true);

    setError("");

    try {
      const response = await fetch("/api/whatsapp/numeros", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          numero,

          propietario: propietarioActual.nombre,

          principal: false,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok && response.status !== 409) {
        throw new Error(data.error ?? "No se pudo registrar el número.");
      }

      const estado = await iniciarSesionPlaywright(numero, false);

      setEstadoSesion(estado);

      setNumeroTemporal(null);

      setMostrandoEstado(true);

      setAbiertoManual(false);

      setNumeroManual("");

      setPropietario("Independiente");

      onChange(numero);

      onPropietarioChange?.(propietarioActual.nombre);

      await cargarEstados();
    } catch (errorRegistro) {
      console.error("Error registrando y usando número:", errorRegistro);

      setError(
        errorRegistro instanceof Error
          ? errorRegistro.message
          : "No se pudo registrar y usar el número.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function usarUnaVez() {
    const numero = normalizarNumero(numeroManual);

    if (!esCelularValido(numero)) {
      setError("Ingresa un celular peruano válido de 9 dígitos.");

      return;
    }

    setProcesando(true);

    setError("");

    try {
      onChange(numero);

      const propietarioTemporal = propietarioSeleccionado();

      onPropietarioChange?.(propietarioTemporal.nombre);

      const estado = await iniciarSesionPlaywright(numero, true);

      setEstadoSesion(estado);

      setNumeroTemporal(numero);

      setMostrandoEstado(true);

      setAbiertoManual(false);

      setNumeroManual("");
    } catch (errorUnaVez) {
      console.error("Error usando número temporal:", errorUnaVez);

      setError(
        errorUnaVez instanceof Error
          ? errorUnaVez.message
          : "No se pudo iniciar el número temporal.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarSesionTemporal() {
    if (!numeroTemporal) {
      return;
    }

    setProcesando(true);

    setError("");

    try {
      const response = await fetch("/api/whatsapp/playwright/cerrar-temporal", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          numero: numeroTemporal,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo cerrar la sesión temporal.");
      }

      setEstadoSesion(null);

      setNumeroTemporal(null);

      setMostrandoEstado(false);

      onChange("");

      onPropietarioChange?.("");

      await cargarEstados();
    } catch (errorCierre) {
      console.error("Error cerrando sesión temporal:", errorCierre);

      setError(
        errorCierre instanceof Error
          ? errorCierre.message
          : "No se pudo cerrar la sesión temporal.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function reconectarNumero(numero: string) {
    setProcesando(true);

    setError("");

    try {
      const estado = await iniciarSesionPlaywright(numero, false);

      setEstadoSesion(estado);

      setMostrandoEstado(true);

      await cargarEstados();
    } catch (errorReconectando) {
      console.error("Error reconectando WhatsApp:", errorReconectando);

      setError(
        errorReconectando instanceof Error
          ? errorReconectando.message
          : "No se pudo reconectar WhatsApp.",
      );
    } finally {
      setProcesando(false);
    }
  }

  const estadoVisual = estadoSesion
    ? obtenerVisualEstado(estadoSesion.estado)
    : null;

  return (
    <div>
      <label className="whatsapp-label">Número de salida</label>

      <div className="mt-1 flex items-center gap-2">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-fondo-sutil)",

            border: "1px solid var(--color-borde)",

            color: "var(--color-accion)",
          }}
        >
          <Phone size={19} />
        </div>

        <select
          value={valor}
          onChange={(event) => seleccionarNumero(event.target.value)}
          className="whatsapp-select min-w-0 flex-1"
        >
          <option value="">Seleccionar número registrado...</option>

          {numeros.map((numero) => {
            const estado = obtenerVisualEstado(numero.estado);

            return (
              <option key={numero.id} value={numero.numero}>
                {formatearNumero(numero.numero)} · {numero.propietario} ·{" "}
                {estado.texto}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-xs font-medium"
          style={{
            color: "var(--color-accion)",
          }}
          onClick={abrirManual}
        >
          Ingresar otro número manualmente
        </button>

        {(numeroSeleccionado || numeroTemporal) && (
          <button
            type="button"
            className="text-xs font-medium"
            style={{
              color: "var(--color-texto-suave)",
            }}
            onClick={() => setMostrandoEstado((actual) => !actual)}
          >
            {mostrandoEstado ? "Ocultar estado" : "Ver estado"}
          </button>
        )}
      </div>

      {!cargandoNumeros && numeros.length === 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <UserRound
            size={14}
            style={{
              color: "var(--color-texto-tenue)",
            }}
          />

          <span
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            Todavía no hay números de salida registrados.
          </span>
        </div>
      )}

      {cargandoNumeros && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Loader2 size={13} className="animate-spin" />

          <span
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            Consultando estados...
          </span>
        </div>
      )}

      {estadoSesion && mostrandoEstado && (
        <div
          className="mt-3 rounded-lg border p-3"
          style={{
            borderColor: "var(--color-borde)",

            background: "var(--color-fondo-sutil)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium">
                {formatearNumero(estadoSesion.numero)}
              </p>

              <p
                className="mt-0.5 text-[11px]"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                {estadoSesion.temporal
                  ? "Sesión temporal"
                  : (numeroSeleccionado?.propietario ?? "Número registrado")}
              </p>
            </div>

            {estadoVisual && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  color: estadoVisual.color,

                  background: estadoVisual.background,
                }}
              >
                {estadoVisual.texto}
              </span>
            )}
          </div>

          <p
            className="mt-2 text-xs"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            {estadoSesion.mensaje}
          </p>

          {estadoSesion.estado === "desconectado" && (
            <button
              type="button"
              className="boton-secundario mt-3"
              disabled={procesando}
              onClick={() => reconectarNumero(estadoSesion.numero)}
            >
              {procesando ? "Abriendo..." : "Abrir WhatsApp"}
            </button>
          )}

          {estadoSesion.estado === "no_vinculado" && (
            <button
              type="button"
              className="boton-secundario mt-3"
              disabled={procesando}
              onClick={() => reconectarNumero(estadoSesion.numero)}
            >
              {procesando ? "Abriendo WhatsApp..." : "Vincular WhatsApp"}
            </button>
          )}

          {estadoSesion.conectado && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <CheckCircle2
                size={14}
                style={{
                  color: "var(--color-exito)",
                }}
              />

              <span
                style={{
                  color: "var(--color-exito)",
                }}
              >
                {estadoSesion.temporal
                  ? "La sesión temporal está lista para utilizarse."
                  : "Esta cuenta está lista para utilizarse como número de salida."}
              </span>
            </div>
          )}

          {estadoSesion.temporal && estadoSesion.conectado && (
            <button
              type="button"
              className="boton-secundario mt-3"
              disabled={procesando}
              onClick={cerrarSesionTemporal}
            >
              {procesando ? "Cerrando sesión..." : "Cerrar sesión temporal"}
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{
            color: "var(--color-alerta)",

            background: "var(--color-alerta-suave)",
          }}
        >
          {error}
        </div>
      )}

      {abiertoManual && (
        <div
          className="mt-3 rounded-xl border p-4"
          style={{
            borderColor: "var(--color-borde)",

            background: "var(--color-fondo-sutil)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Número manual</h3>

              <p
                className="mt-1 text-xs"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Decide si quieres guardarlo o utilizarlo solo una vez.
              </p>
            </div>

            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{
                color: "var(--color-texto-suave)",
              }}
              onClick={cerrarManual}
              disabled={procesando}
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <label className="whatsapp-label">Número</label>

              <div className="mt-1 flex gap-2">
                <span
                  className="flex h-10 items-center rounded-md px-3 text-sm"
                  style={{
                    background: "var(--color-superficie)",

                    border: "1px solid var(--color-borde)",

                    color: "var(--color-texto-suave)",
                  }}
                >
                  +51
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={numeroManual}
                  onChange={(event) =>
                    setNumeroManual(normalizarNumero(event.target.value))
                  }
                  placeholder="9XXXXXXXX"
                  maxLength={9}
                  className="input-estandar min-w-0 w-full"
                />
              </div>
            </div>

            <div>
              <label className="whatsapp-label">Propietario</label>

              <select
                value={propietario}
                onChange={(event) => setPropietario(event.target.value)}
                className="whatsapp-select mt-1"
                disabled={procesando}
              >
                {PROPIETARIOS.map((item) => (
                  <option
                    key={`${item.tipo}-${item.nombre}`}
                    value={item.nombre}
                  >
                    {propietarioEtiqueta(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="boton-secundario w-full"
              disabled={procesando}
              onClick={usarUnaVez}
            >
              {procesando ? "Abriendo..." : "Usar una vez"}
            </button>

            <button
              type="button"
              className="boton-primario w-full"
              disabled={procesando}
              onClick={registrarYUsar}
            >
              {procesando ? "Registrando..." : "Registrar y usar"}
            </button>
          </div>

          <p
            className="mt-3 text-[11px] leading-relaxed"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            “Usar una vez” crea una sesión temporal y no registra el número.
            “Registrar y usar” guarda el número para futuras campañas.
          </p>
        </div>
      )}
    </div>
  );
}
