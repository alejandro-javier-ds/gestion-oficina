// components/HeaderCuenta.tsx
// Incluye teléfono(s) como campo compacto
// con dropdown, más CIC, Router y Nivel de Riesgo.

"use client";

import { useState } from "react";
import { Cuenta } from "@/lib/types";

type Telefono = {
  id_phone: number;
  phone: string;
  tipo_telefono: string;
};

export default function HeaderCuenta({
  cuenta,
  telefonos = [],
  cic,
}: {
  cuenta: Cuenta;
  telefonos?: Telefono[];
  cic?: string | null;
}) {
  const [mostrarTelefonos, setMostrarTelefonos] = useState(false);

  function irAPanelGestion() {
    document
      .getElementById("panel-gestion")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ background: "var(--color-marca)" }} className="text-white">
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-lg"
              style={{ background: "var(--color-accion)" }}
            >
              {cuenta.cliente?.charAt(0) ?? "?"}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Cuenta de cobranza
              </p>
              <h1 className="text-lg font-semibold">{cuenta.cliente}</h1>
            </div>
          </div>

          <button
            onClick={irAPanelGestion}
            className="rounded px-4 py-1.5 text-sm font-medium text-white transition-colors"
            style={{ background: "var(--color-accion)" }}
          >
            + Crear Gestión
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-3 mt-5 text-sm">
          <div>
            <p className="text-xs text-white/60">IDC</p>
            <p className="font-medium dato-numerico">{cuenta.idc}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">CIC</p>
            <p className="font-medium dato-numerico">{cic ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Cuenta</p>
            <p className="font-medium dato-numerico text-xs">
              {cuenta.codcuentacobranza}
            </p>
          </div>
          <div className="relative">
            <p className="text-xs text-white/60">Teléfono</p>
            {telefonos.length === 0 ? (
              <p className="font-medium text-white/50">—</p>
            ) : (
              <button
                onClick={() => setMostrarTelefonos((v) => !v)}
                className="font-medium dato-numerico flex items-center gap-1"
              >
                {telefonos.length} {mostrarTelefonos ? "▲" : "▼"}
              </button>
            )}

            {mostrarTelefonos && telefonos.length > 0 && (
              <div
                className="absolute z-10 mt-1 rounded shadow-lg py-1 min-w-[180px]"
                style={{ background: "var(--color-superficie)" }}
              >
                {telefonos.map((t) => (
                  <div
                    key={t.id_phone}
                    className="px-3 py-1.5 text-sm flex justify-between gap-3"
                    style={{ color: "var(--color-texto)" }}
                  >
                    <span className="dato-numerico">{t.phone}</span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-texto-suave)" }}
                    >
                      {t.tipo_telefono}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-white/60">Monto Deuda (S/)</p>
            <p className="font-medium dato-numerico">{cuenta.mtodeuda_sol}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Días Mora</p>
            <p className="font-medium dato-numerico">
              {cuenta.diasmora} ({cuenta.rango_mora})
            </p>
          </div>
          <div>
            <p className="text-xs text-white/60">Router</p>
            <p className="font-medium">{cuenta.router ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Nivel de Riesgo</p>
            <p className="font-medium">{cuenta.nivel_riesgo ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
