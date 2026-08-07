// components/dashboard/SeccionGestiones.tsx
//
// Orquesta la Sección Gestiones.
//

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import BuscadorGestionesAdmin from "./BuscadorGestionesAdmin";
import FeedActividadReciente from "./FeedActividadReciente";
import GraficoEtapaProcesal from "./GraficoEtapaProcesal";
import GraficoTipoJuicio from "./GraficoTipoJuicio";
import GraficoPie from "./GraficoPie";
import GraficoPrincipalesRazones from "./GraficoPrincipalesRazones";
import TarjetaMontoRecuperado from "./TarjetaMontoRecuperado";
import TablaDinamica from "./TablaDinamica";

import SelectorRangoFecha, {
  rangoInicial,
  type RangoFecha,
} from "./SelectorRangoFecha";

import ModalEditarGestion, {
  type GestionParaEditar,
} from "../ModalEditarGestion";

type FilaFeed = {
  id: number;
  fecha_hora: string;
  gestor: string;
  cliente: string;
  categoria: string | null;
  codigo_razon: string | null;
};

type DatosGestiones = {
  feed: FilaFeed[];

  detalle: Record<string, string | number | null>[];

  porCategoria: {
    categoria: string;
    cantidad: number;
  }[];

  porRazon: {
    razon: string;
    cantidad: number;
  }[];

  porEtapaProcesal: {
    etapa: string;
    cantidad: number;
  }[];

  porTipoJuicio: {
    tipoJuicio: string;
    cantidad: number;
  }[];

  montoRecuperadoMes: number;
};

const CAMPOS = [
  {
    clave: "fecha",
    etiqueta: "Fecha",
  },
  {
    clave: "gestor",
    etiqueta: "Gestor",
  },
  {
    clave: "funcionario",
    etiqueta: "Funcionario",
  },
  {
    clave: "cliente",
    etiqueta: "Cliente",
  },
  {
    clave: "idc",
    etiqueta: "IDC",
  },
  {
    clave: "telefono",
    etiqueta: "Teléfono",
  },
  {
    clave: "segmentacion",
    etiqueta: "Segmentación",
  },
  {
    clave: "categoria",
    etiqueta: "Categoría",
  },
  {
    clave: "codigo_razon",
    etiqueta: "Código de Razón",
  },
  {
    clave: "monto_pagado",
    etiqueta: "Monto Pagado (S/)",
  },
  {
    clave: "observacion",
    etiqueta: "Observación",
  },
  {
    clave: "mtodeuda_sol",
    etiqueta: "Monto Deuda (S/)",
  },
  {
    clave: "diasmora",
    etiqueta: "Días Mora",
  },
  {
    clave: "rango_mora",
    etiqueta: "Rango de Mora",
  },
  {
    clave: "producto",
    etiqueta: "Producto",
  },
  {
    clave: "estado_cartera",
    etiqueta: "Estado de Cartera",
  },
  {
    clave: "etapa_procesal",
    etiqueta: "Etapa Procesal",
  },
  {
    clave: "prioridad",
    etiqueta: "Prioridad",
  },
  {
    clave: "direccion",
    etiqueta: "Dirección",
  },
  {
    clave: "distrito",
    etiqueta: "Distrito",
  },
  {
    clave: "departamento",
    etiqueta: "Departamento",
  },
  {
    clave: "router",
    etiqueta: "Router",
  },
  {
    clave: "nivel_riesgo",
    etiqueta: "Nivel de Riesgo",
  },
  {
    clave: "provincia",
    etiqueta: "Provincia",
  },
  {
    clave: "expediente",
    etiqueta: "Expediente",
  },
  {
    clave: "tipo_juicio",
    etiqueta: "Tipo de Juicio",
  },
  {
    clave: "nro_juicio",
    etiqueta: "N° Juicio",
  },
  {
    clave: "fec_demanda",
    etiqueta: "Fecha de Demanda",
  },
  {
    clave: "supervisor_procesal",
    etiqueta: "Supervisor Procesal",
  },
  {
    clave: "analista_procesal",
    etiqueta: "Analista Procesal",
  },
  {
    clave: "fec_entrega_legajo_a_estudio",
    etiqueta: "Fecha Entrega Legajo a Estudio",
  },
];

const MEDIDAS = [
  {
    clave: "__conteo__",
    etiqueta: "Cantidad de gestiones",
    agregacion: "suma" as const,
  },
  {
    clave: "monto_pagado",
    etiqueta: "Monto pagado (S/)",
    agregacion: "suma" as const,
  },
  {
    clave: "mtodeuda_sol",
    etiqueta: "Monto deuda (S/)",
    agregacion: "suma" as const,
  },
  {
    clave: "diasmora",
    etiqueta: "Días mora (promedio)",
    agregacion: "promedio" as const,
  },
  {
    clave: "n_garantias",
    etiqueta: "N° Garantías (promedio)",
    agregacion: "promedio" as const,
  },
  {
    clave: "valor_garantias",
    etiqueta: "Valor Garantías (S/, promedio)",
    agregacion: "promedio" as const,
  },
  {
    clave: "promesas_vigentes",
    etiqueta: "Promesas Vigentes (promedio)",
    agregacion: "promedio" as const,
  },
  {
    clave: "promesas_cumplidas",
    etiqueta: "Promesas Cumplidas (promedio)",
    agregacion: "promedio" as const,
  },
  {
    clave: "promesas_rotas",
    etiqueta: "Promesas Rotas (promedio)",
    agregacion: "promedio" as const,
  },
  {
    clave: "citas_pendientes",
    etiqueta: "Citas Pendientes (promedio)",
    agregacion: "promedio" as const,
  },
];

const NOMBRE_CATEGORIA: Record<string, string> = {
  TAT: "Tratamiento al titular",
  MCT: "Mensaje con terceros",
  TIN: "Teléfono inválido",
  OTRAS: "Otras gestiones",
  OTRA: "Otras gestiones",
};

const COLOR_CATEGORIA: Record<string, string> = {
  "Tratamiento al titular": "var(--color-accion)",

  "Mensaje con terceros": "var(--color-marca)",

  "Teléfono inválido": "#f97316",

  "Otras gestiones": "#a78bfa",
};

function normalizarCategoria(categoria: string): string {
  const clave = categoria.trim().toUpperCase();

  return NOMBRE_CATEGORIA[clave] ?? categoria;
}

export default function SeccionGestiones() {
  const [rango, setRango] = useState<RangoFecha>(rangoInicial());

  const [datos, setDatos] = useState<DatosGestiones | null>(null);

  const [cargando, setCargando] = useState(true);

  const [gestionEditando, setGestionEditando] =
    useState<GestionParaEditar | null>(null);

  const [modo, setModo] = useState<"editar" | "eliminar">("editar");

  function cargarDatos() {
    setCargando(true);

    fetch(`/api/dashboard/gestiones?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then((res) => res.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarDatos();
  }, [rango]);

  function abrirEditar(f: FilaFeed) {
    setModo("editar");

    setGestionEditando({
      id: f.id,
      cliente: f.cliente,
      usuario_gestor_oficina: f.gestor,
      categoria: f.categoria,
      codigo_razon: f.codigo_razon,
      fecha_hora: f.fecha_hora,
      monto_pagado: null,
      observacion: null,
    });
  }

  function abrirEliminar(f: FilaFeed) {
    setModo("eliminar");

    setGestionEditando({
      id: f.id,
      cliente: f.cliente,
      usuario_gestor_oficina: f.gestor,
      categoria: f.categoria,
      codigo_razon: f.codigo_razon,
      fecha_hora: f.fecha_hora,
      monto_pagado: null,
      observacion: null,
    });
  }

  function alGuardar() {
    setGestionEditando(null);
    cargarDatos();
  }

  const datosCategoria =
    datos?.porCategoria.map((item) => ({
      nombre: normalizarCategoria(item.categoria),
      cantidad: item.cantidad,
    })) ?? [];

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <BuscadorGestionesAdmin />

        <div className="flex lg:justify-end">
          <SelectorRangoFecha valor={rango} onCambiar={setRango} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {cargando && (
          <motion.div
            key="cargando"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.15,
            }}
            className="tarjeta p-6 sm:p-8 text-center"
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            Cargando gestiones...
          </motion.div>
        )}

        {!cargando && !datos && (
          <motion.div
            key="error"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="tarjeta p-6 sm:p-8 text-center"
            style={{
              color: "var(--color-error)",
            }}
          >
            No se pudieron cargar las gestiones.
          </motion.div>
        )}

        {!cargando && datos && (
          <motion.div
            key="datos"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.2,
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              <FeedActividadReciente
                filas={datos.feed}
                onEditar={abrirEditar}
                onEliminar={abrirEliminar}
              />

              <TarjetaMontoRecuperado monto={datos.montoRecuperadoMes} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <GraficoPie
                titulo="Gestiones por categoría"
                datos={datosCategoria}
                colores={COLOR_CATEGORIA}
                mensajeVacio="No hay gestiones registradas en este rango."
              />

              <GraficoPrincipalesRazones datos={datos.porRazon} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <GraficoEtapaProcesal datos={datos.porEtapaProcesal} />

              <GraficoTipoJuicio datos={datos.porTipoJuicio} />
            </div>

            <TablaDinamica
              titulo="Tabla dinámica — Gestiones"
              filas={datos.detalle}
              campos={CAMPOS}
              medidas={MEDIDAS}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ModalEditarGestion
        gestion={gestionEditando}
        modoInicial={modo}
        onCerrar={() => setGestionEditando(null)}
        onGuardado={alGuardar}
      />
    </div>
  );
}
