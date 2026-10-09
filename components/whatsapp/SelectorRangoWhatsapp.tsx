// components/whatsapp/SelectorRangoWhatsapp.tsx
// Selector de rango de fechas para WhatsApp Masivo.
// Devuelve desde, hasta y la etiqueta del rango seleccionado.

"use client";

import {
  CalendarDays,
  Check,
  ChevronUp,
  Clock3,
  History,
  X,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";

export type RangoWhatsapp = {
  desde: string;
  hasta: string;
  etiqueta: string;
};

type Props = {
  valor: RangoWhatsapp;
  onChange: (rango: RangoWhatsapp) => void;
};

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function restarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);

  resultado.setDate(resultado.getDate() - dias);

  return resultado;
}

function primerDiaMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function formatearFecha(valor: string): string {
  if (!valor) return "";

  const [anio, mes, dia] = valor.split("-");

  return `${dia}/${mes}/${anio}`;
}

export default function SelectorRangoWhatsapp({ valor, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);

  const [personalizado, setPersonalizado] = useState(false);

  const [desde, setDesde] = useState(valor.desde);

  const [hasta, setHasta] = useState(valor.hasta);

  const ref = useRef<HTMLDivElement>(null);

  const hoy = useMemo(() => new Date(), []);

  useEffect(() => {
    function cerrar(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setAbierto(false);
      }
    }

    document.addEventListener("mousedown", cerrar);

    return () => {
      document.removeEventListener("mousedown", cerrar);
    };
  }, []);

  useEffect(() => {
    setDesde(valor.desde);
    setHasta(valor.hasta);
  }, [valor.desde, valor.hasta]);

  function aplicar(nuevoDesde: string, nuevoHasta: string, etiqueta: string) {
    setDesde(nuevoDesde);
    setHasta(nuevoHasta);

    onChange({
      desde: nuevoDesde,
      hasta: nuevoHasta,
      etiqueta,
    });

    setAbierto(false);
    setPersonalizado(false);
  }

  const isoHoy = fechaLocalISO(hoy);

  function elegirHoy() {
    aplicar(isoHoy, isoHoy, "Hoy");
  }

  function elegirAyer() {
    const ayer = fechaLocalISO(restarDias(hoy, 1));

    aplicar(ayer, ayer, "Ayer");
  }

  function elegir7Dias() {
    aplicar(fechaLocalISO(restarDias(hoy, 6)), isoHoy, "Últimos 7 días");
  }

  function elegir30Dias() {
    aplicar(fechaLocalISO(restarDias(hoy, 29)), isoHoy, "Últimos 30 días");
  }

  function elegirEsteMes() {
    aplicar(fechaLocalISO(primerDiaMes(hoy)), isoHoy, "Este mes");
  }

  function aplicarPersonalizado() {
    if (!desde || !hasta) {
      return;
    }

    if (desde > hasta) {
      return;
    }

    aplicar(
      desde,
      hasta,
      `${formatearFecha(desde)} → ${formatearFecha(hasta)}`,
    );
  }

  const opciones = [
    {
      etiqueta: "Hoy",
      icono: Clock3,
      accion: elegirHoy,
    },
    {
      etiqueta: "Ayer",
      icono: History,
      accion: elegirAyer,
    },
    {
      etiqueta: "Últimos 7 días",
      icono: CalendarDays,
      accion: elegir7Dias,
    },
    {
      etiqueta: "Últimos 30 días",
      icono: CalendarDays,
      accion: elegir30Dias,
    },
    {
      etiqueta: "Este mes",
      icono: CalendarDays,
      accion: elegirEsteMes,
    },
  ];

  return (
    <div ref={ref} className="relative">
      <label className="whatsapp-label">Rango de gestiones</label>

      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-md px-3"
        style={{
          background: "var(--color-superficie)",
          border: "1px solid var(--color-borde)",
          boxShadow: abierto ? "var(--sombra-focus)" : "none",
        }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{
            background: "var(--color-accion-suave)",
            color: "var(--color-accion)",
          }}
        >
          <CalendarDays size={15} />
        </span>

        <span className="min-w-0 flex-1 text-left">
          <span
            className="block truncate text-sm font-semibold"
            style={{
              color: "var(--color-texto)",
            }}
          >
            {valor.etiqueta}
          </span>

          <span
            className="block truncate text-xs"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            {formatearFecha(valor.desde)} → {formatearFecha(valor.hasta)}
          </span>
        </span>

        <ChevronUp
          size={15}
          className={abierto ? "" : "rotate-180"}
          style={{
            color: "var(--color-texto-suave)",
          }}
        />
      </button>

      {abierto && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[360px] rounded-xl p-2"
          style={{
            background: "var(--color-superficie)",
            border: "1px solid var(--color-borde)",
            boxShadow: "var(--sombra-lg)",
          }}
        >
          {opciones.map((opcion) => {
            const Icono = opcion.icono;

            const activa = valor.etiqueta === opcion.etiqueta;

            return (
              <button
                key={opcion.etiqueta}
                type="button"
                onClick={opcion.accion}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                style={{
                  background: activa
                    ? "var(--color-accion-suave)"
                    : "transparent",
                  color: activa ? "var(--color-accion)" : "var(--color-texto)",
                }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md"
                  style={{
                    background: activa
                      ? "var(--color-accion)"
                      : "var(--color-fondo-sutil)",
                    color: activa ? "#fff" : "var(--color-texto-suave)",
                  }}
                >
                  <Icono size={15} />
                </span>

                <span className="flex-1 text-sm font-medium">
                  {opcion.etiqueta}
                </span>

                {activa && <Check size={16} />}
              </button>
            );
          })}

          <div
            className="mt-1 border-t p-3"
            style={{
              borderColor: "var(--color-borde)",
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{
                  color: "var(--color-texto-suave)",
                }}
              >
                Rango personalizado
              </p>

              {personalizado && (
                <button
                  type="button"
                  onClick={() => setPersonalizado(false)}
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                  aria-label="Cerrar rango personalizado"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {!personalizado ? (
              <button
                type="button"
                onClick={() => {
                  setPersonalizado(true);

                  setDesde(valor.desde);

                  setHasta(valor.hasta);
                }}
                className="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium"
                style={{
                  background: "var(--color-fondo-sutil)",
                  color: "var(--color-texto)",
                }}
              >
                Elegir fechas personalizadas
              </button>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="whatsapp-label">Desde</label>

                    <input
                      type="date"
                      value={desde}
                      onChange={(event) => setDesde(event.target.value)}
                      className="input-estandar mt-1 w-full"
                    />
                  </div>

                  <div>
                    <label className="whatsapp-label">Hasta</label>

                    <input
                      type="date"
                      value={hasta}
                      onChange={(event) => setHasta(event.target.value)}
                      className="input-estandar mt-1 w-full"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!desde || !hasta || desde > hasta}
                  onClick={aplicarPersonalizado}
                  className="boton-primario mt-3 w-full"
                >
                  Aplicar rango
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
