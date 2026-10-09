// components/DetalleCompletoCuenta.tsx
// Muestra las columnas completas de la cuenta, colapsado por
// defecto para no saturar la pantalla en el uso diario.

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Cuenta } from "@/lib/types";

const CAMPOS: { etiqueta: string; clave: keyof Cuenta }[] = [
  { etiqueta: "IDC", clave: "idc" },
  { etiqueta: "Cuenta de Cobranza", clave: "codcuentacobranza" },
  { etiqueta: "Cliente", clave: "cliente" },
  { etiqueta: "Expediente", clave: "expediente" },
  { etiqueta: "Funcionario", clave: "funcionario" },
  { etiqueta: "Gestor", clave: "gestor" },
  { etiqueta: "Monto Deuda (S/)", clave: "mtodeuda_sol" },
  { etiqueta: "Monto Deuda Vencida (S/)", clave: "mtodeudavencida_sol" },
  { etiqueta: "Deuda Total Posición", clave: "dtp" },
  { etiqueta: "Estado de Cartera", clave: "estado_cartera" },
  { etiqueta: "Etapa Procesal", clave: "etapa_procesal" },
  { etiqueta: "Días Mora", clave: "diasmora" },
  { etiqueta: "Rango de Mora", clave: "rango_mora" },
  { etiqueta: "Prioridad", clave: "prioridad" },
  { etiqueta: "Segmentación", clave: "segmentacion" },
  { etiqueta: "Producto", clave: "descproducto" },
  { etiqueta: "Dirección", clave: "direccion" },
  { etiqueta: "Distrito", clave: "distrito" },
  { etiqueta: "Departamento", clave: "departamento" },
  { etiqueta: "Router", clave: "router" },
  { etiqueta: "Nivel de Riesgo", clave: "nivel_riesgo" },
  { etiqueta: "Tipo de Juicio", clave: "tipo_juicio" },
  { etiqueta: "N° Juicio", clave: "nro_juicio" },
];

export default function DetalleCompletoCuenta({ cuenta }: { cuenta: Cuenta }) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="tarjeta p-4 mt-2">
      <button
        onClick={() => setExpandido((v) => !v)}
        className="flex justify-between items-center w-full text-left"
      >
        <h2
          className="font-semibold text-sm"
          style={{ color: "var(--color-texto)" }}
        >
          Detalle completo de la cuenta
        </h2>
        <span
          className="flex items-center gap-1 text-sm font-medium"
          style={{ color: "var(--color-accion)" }}
        >
          {expandido ? "Ver menos" : "Ver todo"}
          {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
              {CAMPOS.map(({ etiqueta, clave }) => (
                <div key={clave} className="min-w-0">
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    {etiqueta}
                  </p>
                  <p className="font-medium truncate">
                    {cuenta[clave] !== null && cuenta[clave] !== undefined
                      ? String(cuenta[clave])
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
