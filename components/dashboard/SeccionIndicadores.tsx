// components/dashboard/SeccionIndicadores.tsx
// Orquesta la Sección Indicadores.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarjetasKpiIndicadores from "./TarjetasKpiIndicadores";
import GaugeCircular from "./GaugeCircular";
import BarrasComparativaGestores from "./BarrasComparativaGestores";
import LineaTendenciaDiaria from "./LineaTendenciaDiaria";
import TablaDinamica from "./TablaDinamica";
import SelectorRangoFecha, {
  rangoInicial,
  type RangoFecha,
} from "./SelectorRangoFecha";

type DatosIndicadores = {
  metaIntensidad: number;
  metaCobertura: number;
  kpis: { totalGestiones: number; clientesDistintos: number };
  intensidadMes: number;
  coberturaMes: number;
  carteraActivaTotal: number;
  comparativaGestores: {
    gestor: string;
    intensidad: number;
    contactabilidad: number;
  }[];
  tendenciaDiaria: { fecha: string; gestiones: number }[];
  resumenDiario: Record<string, string | number | null>[];
  rangoAcumulado: { desde: string; hasta: string };
};

const CAMPOS = [
  { clave: "fecha", etiqueta: "Fecha" },
  { clave: "gestor", etiqueta: "Gestor" },
  { clave: "funcionario", etiqueta: "Funcionario" },
];

const MEDIDAS = [
  {
    clave: "gestionesRealizadas",
    etiqueta: "Gestiones Realizadas",
    agregacion: "suma" as const,
  },
  {
    clave: "clientesDistintosConTat",
    etiqueta: "Clientes Distintos con Contacto Directo",
    agregacion: "suma" as const,
  },
  {
    clave: "intensidadDiaria",
    etiqueta: "Intensidad Diaria",
    agregacion: "promedio" as const,
  },
  {
    clave: "contactabilidadDiaria",
    etiqueta: "Contactabilidad Diaria (%)",
    agregacion: "promedio" as const,
  },
  {
    clave: "promesasCreadas",
    etiqueta: "Promesas Creadas",
    agregacion: "suma" as const,
  },
  {
    clave: "promesasCumplidasPorcentaje",
    etiqueta: "Promesas Cumplidas (%)",
    agregacion: "promedio" as const,
  },
  {
    clave: "citasAgendadas",
    etiqueta: "Citas Agendadas",
    agregacion: "suma" as const,
  },
];

function formatearFechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export default function SeccionIndicadores() {
  const [rango, setRango] = useState<RangoFecha>(rangoInicial());
  const [datos, setDatos] = useState<DatosIndicadores | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    fetch(
      `/api/dashboard/indicadores?desde=${rango.desde}&hasta=${rango.hasta}`,
    )
      .then((res) => res.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }, [rango]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SelectorRangoFecha valor={rango} onCambiar={setRango} />
      </div>

      <AnimatePresence mode="wait">
        {cargando && (
          <motion.div
            key="cargando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="tarjeta p-8 text-center"
            style={{ color: "var(--color-texto-suave)" }}
          >
            Cargando indicadores...
          </motion.div>
        )}

        {!cargando && !datos && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="tarjeta p-8 text-center"
            style={{ color: "var(--color-error)" }}
          >
            No se pudieron cargar los indicadores.
          </motion.div>
        )}

        {!cargando && datos && (
          <motion.div
            key="datos"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <TarjetasKpiIndicadores
              totalGestiones={datos.kpis.totalGestiones}
              clientesDistintos={datos.kpis.clientesDistintos}
              etiquetaRango={rango.etiqueta}
            />

            <div className="tarjeta px-4 py-2.5">
              <p
                className="text-xs"
                style={{ color: "var(--color-texto-tenue)" }}
              >
                Intensidad y Cobertura son metas mensuales — siempre muestran el
                acumulado del {formatearFechaCorta(datos.rangoAcumulado.desde)}{" "}
                al {formatearFechaCorta(datos.rangoAcumulado.hasta)}, sin
                importar el rango elegido arriba.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <GaugeCircular
                  titulo="Intensidad vs. meta"
                  valor={datos.intensidadMes}
                  meta={datos.metaIntensidad}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.06 }}
              >
                <GaugeCircular
                  titulo={`Cobertura vs. meta (de ${datos.carteraActivaTotal} clientes activos)`}
                  valor={datos.coberturaMes}
                  meta={datos.metaCobertura}
                  sufijo="%"
                  decimales={0}
                />
              </motion.div>
            </div>

            <BarrasComparativaGestores datos={datos.comparativaGestores} />
            <LineaTendenciaDiaria datos={datos.tendenciaDiaria} />

            <TablaDinamica
              titulo="Tabla dinámica — Indicadores"
              filas={datos.resumenDiario}
              campos={CAMPOS}
              medidas={MEDIDAS}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
