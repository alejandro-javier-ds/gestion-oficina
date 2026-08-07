// components/whatsapp/ExportarMensajesWhatsapp.tsx
// Exporta exclusivamente campañas/mensajes preparados por WhatsApp Masivo.
//
// Hojas:
// - Gestiones
// - PDPs

"use client";

import { Download, FileSpreadsheet, ListChecks } from "lucide-react";

import { useState } from "react";

function obtenerHoyLocal(): string {
  const fecha = new Date();

  const year = fecha.getFullYear();

  const month = String(fecha.getMonth() + 1).padStart(2, "0");

  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function obtenerInicioMesLocal(): string {
  const fecha = new Date();

  const year = fecha.getFullYear();

  const month = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

const GESTORES = [
  "Geraldine Salazar",
  "Glycel Lozada",
  "Gonzalo Barrientos",
  "Miguel Rodriguez",
];

type TipoExportacion = "gestiones" | "pdps";

export default function ExportarMensajesWhatsapp() {
  const [desde, setDesde] = useState(obtenerInicioMesLocal());

  const [hasta, setHasta] = useState(obtenerHoyLocal());

  const [gestor, setGestor] = useState("");

  const [tipos, setTipos] = useState<Record<TipoExportacion, boolean>>({
    gestiones: true,

    pdps: true,
  });

  const [exportando, setExportando] = useState(false);

  const [error, setError] = useState("");

  function cambiarTipo(tipo: TipoExportacion) {
    setTipos((actual) => ({
      ...actual,
      [tipo]: !actual[tipo],
    }));
  }

  async function exportar() {
    setError("");

    if (desde && hasta && desde > hasta) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.");

      return;
    }

    if (!tipos.gestiones && !tipos.pdps) {
      setError("Selecciona al menos una hoja para exportar.");

      return;
    }

    const params = new URLSearchParams();

    params.set("desde", desde);

    params.set("hasta", hasta);

    if (gestor) {
      params.set("gestor", gestor);
    }

    if (tipos.gestiones) {
      params.set("gestiones", "1");
    }

    if (tipos.pdps) {
      params.set("pdps", "1");
    }

    setExportando(true);

    try {
      const response = await fetch(
        `/api/whatsapp/exportar-mensajes?${params.toString()}`,
        {
          method: "GET",

          cache: "no-store",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(data?.error ?? "No se pudo generar el Excel.");
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const enlace = document.createElement("a");

      enlace.href = url;

      enlace.download = "exportar_mensajes_whatsapp.xlsx";

      document.body.appendChild(enlace);

      enlace.click();

      enlace.remove();

      URL.revokeObjectURL(url);
    } catch (errorExportando) {
      console.error("Error exportando mensajes WhatsApp:", errorExportando);

      setError(
        errorExportando instanceof Error
          ? errorExportando.message
          : "No se pudo generar el Excel.",
      );
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="tarjeta p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="whatsapp-icono">
          <FileSpreadsheet size={18} />
        </div>

        <div>
          <h2 className="text-base font-semibold">Exportar mensajes</h2>

          <p
            className="mt-1 text-sm"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            Exporta las campañas preparadas de WhatsApp Masivo en Excel.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="exportar-mensajes-desde" className="whatsapp-label">
            Desde
          </label>

          <input
            id="exportar-mensajes-desde"
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            className="input-estandar mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="exportar-mensajes-hasta" className="whatsapp-label">
            Hasta
          </label>

          <input
            id="exportar-mensajes-hasta"
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            className="input-estandar mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="exportar-mensajes-gestor" className="whatsapp-label">
            Gestor
          </label>

          <select
            id="exportar-mensajes-gestor"
            value={gestor}
            onChange={(event) => setGestor(event.target.value)}
            className="whatsapp-select mt-1"
          >
            <option value="">Todos los gestores</option>

            {GESTORES.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}

                {nombre === "Miguel Rodriguez" ? " (Supervisor)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="mt-5 border-t pt-5"
        style={{
          borderColor: "var(--color-borde)",
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <ListChecks
            size={17}
            style={{
              color: "var(--color-accion)",
            }}
          />

          <div>
            <h3 className="text-sm font-semibold">Información a exportar</h3>

            <p
              className="mt-1 text-xs"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Cada selección se generará como una hoja independiente dentro del
              mismo Excel.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => cambiarTipo("gestiones")}
            className="rounded-xl border p-4 text-left transition"
            style={{
              borderColor: tipos.gestiones
                ? "var(--color-accion)"
                : "var(--color-borde)",

              background: tipos.gestiones
                ? "var(--color-accion-suave)"
                : "var(--color-fondo-sutil)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: tipos.gestiones
                    ? "var(--color-superficie)"
                    : "var(--color-fondo-sutil)",

                  color: tipos.gestiones
                    ? "var(--color-accion)"
                    : "var(--color-texto-suave)",
                }}
              >
                <FileSpreadsheet size={17} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold">Gestiones</p>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  Mensajes preparados de las campañas de Gestiones.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => cambiarTipo("pdps")}
            className="rounded-xl border p-4 text-left transition"
            style={{
              borderColor: tipos.pdps
                ? "var(--color-accion)"
                : "var(--color-borde)",

              background: tipos.pdps
                ? "var(--color-accion-suave)"
                : "var(--color-fondo-sutil)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: tipos.pdps
                    ? "var(--color-superficie)"
                    : "var(--color-fondo-sutil)",

                  color: tipos.pdps
                    ? "var(--color-accion)"
                    : "var(--color-texto-suave)",
                }}
              >
                <FileSpreadsheet size={17} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold">PDPs</p>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  Mensajes preparados de Posible Pago, 100% Confiable y Fin de
                  Acuerdo.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div
        className="mt-5 rounded-lg border p-4"
        style={{
          background: "var(--color-fondo-sutil)",

          borderColor: "var(--color-borde)",
        }}
      >
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Período:
            </span>{" "}
            <strong>
              {desde || "Sin inicio"}

              {" → "}

              {hasta || "Sin fin"}
            </strong>
          </div>

          <div>
            <span
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Gestor:
            </span>{" "}
            <strong>{gestor || "Todos"}</strong>
          </div>

          <div>
            <span
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Hojas:
            </span>{" "}
            <strong>{Object.values(tipos).filter(Boolean).length}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg p-3 text-sm"
          style={{
            color: "var(--color-alerta)",

            background: "var(--color-alerta-suave)",
          }}
        >
          {error}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="boton-primario inline-flex items-center gap-2"
          onClick={exportar}
          disabled={exportando}
        >
          <Download size={16} />

          {exportando ? "Generando Excel..." : "Exportar mensajes"}
        </button>
      </div>
    </section>
  );
}
