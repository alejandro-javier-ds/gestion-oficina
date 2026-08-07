// components/dashboard/TablaDinamica.tsx
// Tabla dinámica real, estilo Excel

"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Download,
  GripVertical,
  X,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";

type Campo = { clave: string; etiqueta: string };
type Medida = {
  clave: string;
  etiqueta: string;
  agregacion: "suma" | "promedio";
};

type Props = {
  titulo?: string;
  filas: Record<string, string | number | null>[];
  campos: Campo[];
  medidas: Medida[];
  filasIniciales?: string[];
  columnasIniciales?: string[];
  valoresIniciales?: string[];
};

type Zonas = {
  filtros: string[];
  filas: string[];
  columnas: string[];
  valores: string[];
};

const SIN_DATO = "Sin dato";
const SEPARADOR = "◆";

function claveCompuesta(
  row: Record<string, string | number | null>,
  camposEje: string[],
): string {
  if (camposEje.length === 0) return "Total";
  return camposEje.map((c) => String(row[c] ?? SIN_DATO)).join(SEPARADOR);
}

function etiquetaLegible(clave: string): string {
  return clave === "Total" ? "Total" : clave.split(SEPARADOR).join(" / ");
}

function ChipArrastrable({ id, etiqueta }: { id: string; etiqueta: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded text-xs font-medium cursor-grab active:cursor-grabbing select-none touch-none"
      style={{
        background: "var(--color-fondo-sutil)",
        color: "var(--color-texto)",
        opacity: isDragging ? 0.4 : 1,
        border: "1px solid var(--color-borde)",
      }}
    >
      <GripVertical size={12} style={{ color: "var(--color-texto-tenue)" }} />
      {etiqueta}
    </div>
  );
}

function ZonaSoltable({
  id,
  titulo,
  vacio,
  children,
}: {
  id: string;
  titulo: string;
  vacio: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: "var(--color-texto-suave)" }}
      >
        {titulo}
      </p>
      <div
        ref={setNodeRef}
        className="min-h-[44px] sm:min-h-[48px] rounded p-2 flex flex-wrap gap-1.5 transition-colors"
        style={{
          background: isOver
            ? "var(--color-accion-suave)"
            : "var(--color-fondo-sutil)",
          border: `1.5px dashed ${isOver ? "var(--color-accion)" : "var(--color-borde)"}`,
        }}
      >
        {vacio && !isOver && (
          <p
            className="text-xs py-1.5 px-1"
            style={{ color: "var(--color-texto-tenue)" }}
          >
            Arrastra un campo aquí
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function ChipEnZona({
  etiqueta,
  onQuitar,
  onSubir,
  onBajar,
  puedeSubir,
  puedeBajar,
  onClickFiltro,
  filtroAbierto,
}: {
  etiqueta: string;
  onQuitar: () => void;
  onSubir?: () => void;
  onBajar?: () => void;
  puedeSubir?: boolean;
  puedeBajar?: boolean;
  onClickFiltro?: () => void;
  filtroAbierto?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 pl-2 pr-1 py-1 rounded text-xs font-medium"
      style={{
        background: filtroAbierto
          ? "var(--color-accion)"
          : "var(--color-superficie)",
        color: filtroAbierto ? "white" : "var(--color-texto)",
        border: "1px solid var(--color-borde)",
      }}
    >
      <button
        onClick={onClickFiltro}
        style={{ cursor: onClickFiltro ? "pointer" : "default" }}
      >
        {etiqueta}
      </button>
      {onSubir && (
        <button
          onClick={onSubir}
          disabled={!puedeSubir}
          className="disabled:opacity-30"
        >
          <ChevronUp size={11} />
        </button>
      )}
      {onBajar && (
        <button
          onClick={onBajar}
          disabled={!puedeBajar}
          className="disabled:opacity-30"
        >
          <ChevronDown size={11} />
        </button>
      )}
      <button
        onClick={onQuitar}
        className="ml-0.5 opacity-60 hover:opacity-100"
      >
        <X size={11} />
      </button>
    </div>
  );
}

export default function TablaDinamica({
  titulo = "Tabla dinámica",
  filas,
  campos,
  medidas,
  filasIniciales,
  columnasIniciales,
  valoresIniciales,
}: Props) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [zonas, setZonas] = useState<Zonas>({
    filtros: [],
    filas: filasIniciales ?? [],
    columnas: columnasIniciales ?? [],
    valores: valoresIniciales ?? [],
  });
  const [valoresFiltro, setValoresFiltro] = useState<
    Record<string, Set<string>>
  >({});
  const [filtroAbierto, setFiltroAbierto] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
  );

  const camposUsados = new Set([
    ...zonas.filtros,
    ...zonas.filas,
    ...zonas.columnas,
  ]);
  const camposDisponibles = campos.filter((c) => !camposUsados.has(c.clave));
  const medidasDisponibles = medidas.filter(
    (m) => !zonas.valores.includes(m.clave),
  );

  function quitarDeTodasLasZonas(clave: string) {
    setZonas((z) => ({
      filtros: z.filtros.filter((c) => c !== clave),
      filas: z.filas.filter((c) => c !== clave),
      columnas: z.columnas.filter((c) => c !== clave),
      valores: z.valores,
    }));
    setValoresFiltro((v) => {
      const copia = { ...v };
      delete copia[clave];
      return copia;
    });
  }

  function manejarSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over) return;

    const esMedida = String(active.id).startsWith("medida-");
    const clave = String(active.id).replace(
      esMedida ? "medida-" : "campo-",
      "",
    );
    const zonaDestino = String(over.id).replace("zona-", "");

    if (esMedida) {
      if (zonaDestino !== "valores") return;
      setZonas((z) =>
        z.valores.includes(clave)
          ? z
          : { ...z, valores: [...z.valores, clave] },
      );
      return;
    }

    if (zonaDestino === "disponibles") {
      quitarDeTodasLasZonas(clave);
      return;
    }
    if (!["filtros", "filas", "columnas"].includes(zonaDestino)) return;

    setZonas((z) => {
      const limpio: Zonas = {
        filtros: z.filtros.filter((c) => c !== clave),
        filas: z.filas.filter((c) => c !== clave),
        columnas: z.columnas.filter((c) => c !== clave),
        valores: z.valores,
      };
      (limpio as unknown as Record<string, string[]>)[zonaDestino] = [
        ...(limpio as unknown as Record<string, string[]>)[zonaDestino],
        clave,
      ];
      return limpio;
    });
  }

  function reordenar(
    zona: "filas" | "columnas",
    indice: number,
    direccion: -1 | 1,
  ) {
    setZonas((z) => {
      const lista = [...z[zona]];
      const nuevoIndice = indice + direccion;
      if (nuevoIndice < 0 || nuevoIndice >= lista.length) return z;
      [lista[indice], lista[nuevoIndice]] = [lista[nuevoIndice], lista[indice]];
      return { ...z, [zona]: lista };
    });
  }

  function quitarMedida(clave: string) {
    setZonas((z) => ({ ...z, valores: z.valores.filter((v) => v !== clave) }));
  }

  const valoresDistintosPorCampo = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const campoFiltro of zonas.filtros) {
      const set = new Set<string>();
      for (const f of filas) set.add(String(f[campoFiltro] ?? SIN_DATO));
      mapa[campoFiltro] = Array.from(set).sort((a, b) =>
        a.localeCompare(b, "es"),
      );
    }
    return mapa;
  }, [filas, zonas.filtros]);

  function alternarValorFiltro(campo: string, valor: string) {
    setValoresFiltro((prev) => {
      const actual =
        prev[campo] ?? new Set(valoresDistintosPorCampo[campo] ?? []);
      const copia = new Set(actual);
      if (copia.has(valor)) copia.delete(valor);
      else copia.add(valor);
      return { ...prev, [campo]: copia };
    });
  }

  const {
    filasPivot,
    columnasPivot,
    medidasEfectivas,
    celda,
    totalColumna,
    totalFila,
    totalGeneral,
  } = useMemo(() => {
    const medidasEfectivas: Medida[] =
      zonas.valores.length > 0
        ? zonas.valores
            .map((clave) => medidas.find((m) => m.clave === clave)!)
            .filter(Boolean)
        : [{ clave: "__conteo__", etiqueta: "Cantidad", agregacion: "suma" }];

    if (zonas.filas.length === 0) {
      return {
        filasPivot: [] as string[],
        columnasPivot: [] as string[],
        medidasEfectivas,
        celda: () => null as number | null,
        totalColumna: () => 0,
        totalFila: () => 0,
        totalGeneral: () => 0,
      };
    }

    const datosFiltrados = filas.filter((row) =>
      zonas.filtros.every((campoFiltro) => {
        const seleccion = valoresFiltro[campoFiltro];
        if (!seleccion) return true;
        return seleccion.has(String(row[campoFiltro] ?? SIN_DATO));
      }),
    );

    const setFilas = new Set<string>();
    const setColumnas = new Set<string>();
    const acumulador = new Map<string, { total: number; conteo: number }>();

    for (const row of datosFiltrados) {
      const filaKey = claveCompuesta(row, zonas.filas);
      const columnaKey = claveCompuesta(row, zonas.columnas);
      setFilas.add(filaKey);
      setColumnas.add(columnaKey);

      for (const medida of medidasEfectivas) {
        const valorNumerico =
          medida.clave === "__conteo__" ? 1 : Number(row[medida.clave] ?? 0);
        const llave = `${filaKey}${SEPARADOR}${columnaKey}${SEPARADOR}${medida.clave}`;
        const actual = acumulador.get(llave) ?? { total: 0, conteo: 0 };
        actual.total += valorNumerico;
        actual.conteo += 1;
        acumulador.set(llave, actual);
      }
    }

    function agregado(llave: string, medida: Medida): number | null {
      const dato = acumulador.get(llave);
      if (!dato) return null;
      return medida.agregacion === "promedio"
        ? dato.total / dato.conteo
        : dato.total;
    }

    function celda(
      filaKey: string,
      columnaKey: string,
      medida: Medida,
    ): number | null {
      return agregado(
        `${filaKey}${SEPARADOR}${columnaKey}${SEPARADOR}${medida.clave}`,
        medida,
      );
    }

    function totalFila(filaKey: string, medida: Medida): number {
      const valores = Array.from(setColumnas)
        .map((columnaKey) => celda(filaKey, columnaKey, medida))
        .filter((v): v is number => v !== null);
      if (valores.length === 0) return 0;
      return medida.agregacion === "promedio"
        ? valores.reduce((a, b) => a + b, 0) / valores.length
        : valores.reduce((a, b) => a + b, 0);
    }

    function totalColumna(columnaKey: string, medida: Medida): number {
      const valores = Array.from(setFilas)
        .map((filaKey) => celda(filaKey, columnaKey, medida))
        .filter((v): v is number => v !== null);
      if (valores.length === 0) return 0;
      return medida.agregacion === "promedio"
        ? valores.reduce((a, b) => a + b, 0) / valores.length
        : valores.reduce((a, b) => a + b, 0);
    }

    function totalGeneral(medida: Medida): number {
      const valores = Array.from(setFilas)
        .map((filaKey) => totalFila(filaKey, medida))
        .filter((v) => v !== null);
      if (valores.length === 0) return 0;
      return medida.agregacion === "promedio"
        ? valores.reduce((a, b) => a + b, 0) / valores.length
        : valores.reduce((a, b) => a + b, 0);
    }

    return {
      filasPivot: Array.from(setFilas).sort((a, b) => a.localeCompare(b, "es")),
      columnasPivot: Array.from(setColumnas).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
      medidasEfectivas,
      celda,
      totalColumna,
      totalFila,
      totalGeneral,
    };
  }, [filas, zonas, valoresFiltro, medidas]);

  function formatear(valor: number | null, medida: Medida): string {
    if (valor === null) return "—";
    return medida.agregacion === "promedio"
      ? valor.toFixed(1)
      : valor.toLocaleString("es-PE");
  }

  const etiquetaFilas =
    zonas.filas
      .map((c) => campos.find((x) => x.clave === c)?.etiqueta)
      .join(" / ") || "Total";
  const etiquetaColumnas =
    zonas.columnas
      .map((c) => campos.find((x) => x.clave === c)?.etiqueta)
      .join(" / ") || "Total";
  const etiquetasValores = medidasEfectivas.map((m) => m.etiqueta).join(", ");
  const etiquetasFiltros = zonas.filtros
    .map((c) => campos.find((x) => x.clave === c)?.etiqueta)
    .join(", ");

  async function exportarExcel() {
    setExportando(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const hoja = workbook.addWorksheet(titulo.slice(0, 31));

      const filaEnc1 = [etiquetaFilas];
      const filaEnc2 = [""];
      for (const columnaKey of columnasPivot) {
        for (const medida of medidasEfectivas) {
          filaEnc1.push(etiquetaLegible(columnaKey));
          filaEnc2.push(medida.etiqueta);
        }
      }
      filaEnc1.push("Total");
      filaEnc2.push("");

      hoja.addRow(filaEnc1);
      hoja.addRow(filaEnc2);
      [1, 2].forEach((n) => {
        hoja.getRow(n).eachCell((c) => {
          c.font = { bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0D6E4F" },
          };
        });
      });

      for (const filaKey of filasPivot) {
        const fila: (string | number)[] = [etiquetaLegible(filaKey)];
        for (const columnaKey of columnasPivot) {
          for (const medida of medidasEfectivas)
            fila.push(celda(filaKey, columnaKey, medida) ?? "");
        }
        for (const medida of medidasEfectivas)
          fila.push(totalFila(filaKey, medida));
        hoja.addRow(fila);
      }

      const filaTotales: (string | number)[] = ["Total"];
      for (const columnaKey of columnasPivot) {
        for (const medida of medidasEfectivas)
          filaTotales.push(totalColumna(columnaKey, medida));
      }
      for (const medida of medidasEfectivas)
        filaTotales.push(totalGeneral(medida));
      const filaT = hoja.addRow(filaTotales);
      filaT.font = { bold: true };

      hoja.columns.forEach((c) => (c.width = 16));
      hoja.views = [{ state: "frozen", ySplit: 2, xSplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `${titulo.replace(/\s+/g, "_")}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="tarjeta p-4 sm:p-5" style={{ borderRadius: "16px" }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p
            className="text-xs uppercase tracking-wide font-medium flex items-center gap-1.5 mb-2"
            style={{ color: "var(--color-texto-suave)" }}
          >
            <LayoutGrid size={14} /> {titulo}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip chip-neutral">Filas: {etiquetaFilas}</span>
            <span className="chip chip-neutral">
              Columnas: {etiquetaColumnas}
            </span>
            <span className="chip chip-accion">
              Valores: {etiquetasValores}
            </span>
            {zonas.filtros.length > 0 && (
              <span className="chip chip-neutral">
                Filtros: {etiquetasFiltros}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanelAbierto(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              background: "var(--color-fondo-sutil)",
              color: "var(--color-texto)",
              border: "1px solid var(--color-borde)",
            }}
          >
            <SlidersHorizontal size={13} />
            <span className="hidden xs:inline sm:inline">
              Configurar campos
            </span>
            <span className="inline xs:hidden sm:hidden">Configurar</span>
          </button>
          <button
            onClick={exportarExcel}
            disabled={exportando || filasPivot.length === 0}
            className="boton-primario flex items-center gap-1.5 text-xs py-1.5 px-3 disabled:opacity-50"
          >
            <Download size={13} />
            {exportando ? "Exportando..." : "Excel"}
          </button>
        </div>
      </div>

      <div
        className="overflow-auto"
        style={{
          border: "1px solid var(--color-borde)",
          borderRadius: "10px",
          maxHeight: 440,
        }}
      >
        <table className="text-xs sm:text-sm whitespace-nowrap border-collapse">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="p-1.5 sm:p-2 text-left sticky top-0 left-0 z-20"
                style={{
                  background: "var(--color-accion)",
                  color: "white",
                  minWidth: 140,
                  borderTopLeftRadius: "9px",
                }}
              >
                {etiquetaFilas}
              </th>
              {columnasPivot.map((columnaKey, idx) => (
                <th
                  key={columnaKey}
                  colSpan={medidasEfectivas.length}
                  className="p-1.5 sm:p-2 text-center font-medium sticky top-0 z-10"
                  style={{
                    background: "var(--color-accion)",
                    color: "white",
                    borderLeft: "1px solid rgba(255,255,255,0.15)",
                    borderTopRightRadius:
                      idx === columnasPivot.length - 1 ? "9px" : undefined,
                  }}
                >
                  {etiquetaLegible(columnaKey)}
                </th>
              ))}
              <th
                rowSpan={2}
                className="p-1.5 sm:p-2 text-right font-semibold sticky top-0 right-0 z-20"
                style={{
                  background: "var(--color-marca)",
                  color: "white",
                  minWidth: 90,
                  borderLeft: "1px solid rgba(255,255,255,0.15)",
                  borderTopRightRadius: "9px",
                }}
              >
                Total
              </th>
            </tr>
            <tr>
              {columnasPivot.map((columnaKey) =>
                medidasEfectivas.map((medida) => (
                  <th
                    key={`${columnaKey}-${medida.clave}`}
                    className="p-1 sm:p-1.5 text-right font-normal sticky z-10"
                    style={{
                      top: 30,
                      background: "#27272a",
                      color: "white",
                      minWidth: 90,
                      borderLeft: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 10,
                    }}
                  >
                    {medida.etiqueta}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {filasPivot.length === 0 ? (
              <tr>
                <td
                  colSpan={columnasPivot.length * medidasEfectivas.length + 2}
                  className="p-6 text-center"
                  style={{ color: "var(--color-texto-tenue)" }}
                >
                  Sin datos todavía.
                </td>
              </tr>
            ) : (
              filasPivot.map((filaKey, i) => (
                <tr
                  key={filaKey}
                  style={{
                    background:
                      i % 2 === 0
                        ? "var(--color-superficie)"
                        : "var(--color-fondo-sutil)",
                  }}
                >
                  <td
                    className="p-1.5 sm:p-2 font-medium sticky left-0 z-10"
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--color-superficie)"
                          : "var(--color-fondo-sutil)",
                      borderRight: "1px solid var(--color-borde)",
                      borderBottom: "1px solid var(--color-borde)",
                    }}
                  >
                    {etiquetaLegible(filaKey)}
                  </td>
                  {columnasPivot.map((columnaKey) =>
                    medidasEfectivas.map((medida) => (
                      <td
                        key={`${columnaKey}-${medida.clave}`}
                        className="p-1.5 sm:p-2 text-right dato-numerico"
                        style={{
                          borderLeft: "1px solid var(--color-borde)",
                          borderBottom: "1px solid var(--color-borde)",
                        }}
                      >
                        {formatear(celda(filaKey, columnaKey, medida), medida)}
                      </td>
                    )),
                  )}
                  <td
                    className="p-1.5 sm:p-2 text-right dato-numerico font-semibold sticky right-0 z-10"
                    style={{
                      background: "var(--color-accion-suave)",
                      color: "var(--color-accion)",
                      borderLeft: "1px solid var(--color-borde)",
                      borderBottom: "1px solid var(--color-borde)",
                    }}
                  >
                    {formatear(
                      totalFila(filaKey, medidasEfectivas[0]),
                      medidasEfectivas[0],
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filasPivot.length > 0 && (
            <tfoot>
              <tr>
                <td
                  className="p-1.5 sm:p-2 font-semibold sticky left-0 bottom-0 z-10"
                  style={{
                    background: "var(--color-fondo-sutil)",
                    borderTop: "2px solid var(--color-borde-fuerte)",
                    borderBottomLeftRadius: "9px",
                  }}
                >
                  Total
                </td>
                {columnasPivot.map((columnaKey) =>
                  medidasEfectivas.map((medida) => (
                    <td
                      key={`${columnaKey}-${medida.clave}`}
                      className="p-1.5 sm:p-2 text-right dato-numerico font-semibold"
                      style={{
                        background: "var(--color-fondo-sutil)",
                        borderTop: "2px solid var(--color-borde-fuerte)",
                        borderLeft: "1px solid var(--color-borde)",
                      }}
                    >
                      {formatear(totalColumna(columnaKey, medida), medida)}
                    </td>
                  )),
                )}
                <td
                  className="p-1.5 sm:p-2 text-right dato-numerico font-bold sticky right-0 bottom-0 z-10"
                  style={{
                    background: "var(--color-accion)",
                    color: "white",
                    borderTop: "2px solid var(--color-borde-fuerte)",
                    borderBottomRightRadius: "9px",
                  }}
                >
                  {formatear(
                    totalGeneral(medidasEfectivas[0]),
                    medidasEfectivas[0],
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {panelAbierto && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setPanelAbierto(false)}
        />
      )}
      <div
        className="fixed top-0 right-0 h-screen z-50 transition-transform duration-300 overflow-y-auto"
        style={{
          width: 380,
          maxWidth: "100vw",
          background: "var(--color-superficie)",
          boxShadow: "var(--sombra-lg)",
          transform: panelAbierto ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <DndContext sensors={sensores} onDragEnd={manejarSoltar}>
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <SlidersHorizontal size={15} /> Campos de la tabla dinámica
              </p>
              <button
                onClick={() => setPanelAbierto(false)}
                className="p-1 rounded hover:opacity-70"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <ZonaSoltable
                id="zona-disponibles"
                titulo="Campos disponibles"
                vacio={camposDisponibles.length === 0}
              >
                {camposDisponibles.map((c) => (
                  <ChipArrastrable
                    key={c.clave}
                    id={`campo-${c.clave}`}
                    etiqueta={c.etiqueta}
                  />
                ))}
              </ZonaSoltable>

              <ZonaSoltable
                id="zona-filtros"
                titulo="Filtros"
                vacio={zonas.filtros.length === 0}
              >
                {zonas.filtros.map((clave) => {
                  const campo = campos.find((c) => c.clave === clave)!;
                  return (
                    <div key={clave} className="w-full">
                      <ChipEnZona
                        etiqueta={`${campo.etiqueta} ▾`}
                        onQuitar={() => quitarDeTodasLasZonas(clave)}
                        onClickFiltro={() =>
                          setFiltroAbierto(
                            filtroAbierto === clave ? null : clave,
                          )
                        }
                        filtroAbierto={filtroAbierto === clave}
                      />
                      {filtroAbierto === clave && (
                        <div
                          className="mt-1 p-2 rounded max-h-40 overflow-auto w-full"
                          style={{
                            background: "var(--color-fondo-sutil)",
                            border: "1px solid var(--color-borde)",
                          }}
                        >
                          {(valoresDistintosPorCampo[clave] ?? []).map(
                            (valor) => {
                              const seleccion = valoresFiltro[clave];
                              const marcado = seleccion
                                ? seleccion.has(valor)
                                : true;
                              return (
                                <label
                                  key={valor}
                                  className="flex items-center gap-2 text-xs py-0.5 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    onChange={() =>
                                      alternarValorFiltro(clave, valor)
                                    }
                                  />
                                  {valor}
                                </label>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </ZonaSoltable>

              <ZonaSoltable
                id="zona-filas"
                titulo="Filas"
                vacio={zonas.filas.length === 0}
              >
                {zonas.filas.map((clave, i) => {
                  const campo = campos.find((c) => c.clave === clave)!;
                  return (
                    <ChipEnZona
                      key={clave}
                      etiqueta={campo.etiqueta}
                      onQuitar={() => quitarDeTodasLasZonas(clave)}
                      onSubir={() => reordenar("filas", i, -1)}
                      onBajar={() => reordenar("filas", i, 1)}
                      puedeSubir={i > 0}
                      puedeBajar={i < zonas.filas.length - 1}
                    />
                  );
                })}
              </ZonaSoltable>

              <ZonaSoltable
                id="zona-columnas"
                titulo="Columnas"
                vacio={zonas.columnas.length === 0}
              >
                {zonas.columnas.map((clave, i) => {
                  const campo = campos.find((c) => c.clave === clave)!;
                  return (
                    <ChipEnZona
                      key={clave}
                      etiqueta={campo.etiqueta}
                      onQuitar={() => quitarDeTodasLasZonas(clave)}
                      onSubir={() => reordenar("columnas", i, -1)}
                      onBajar={() => reordenar("columnas", i, 1)}
                      puedeSubir={i > 0}
                      puedeBajar={i < zonas.columnas.length - 1}
                    />
                  );
                })}
              </ZonaSoltable>

              <ZonaSoltable
                id="zona-valores"
                titulo="Valores"
                vacio={zonas.valores.length === 0}
              >
                {zonas.valores.map((clave) => {
                  const medida = medidas.find((m) => m.clave === clave)!;
                  return (
                    <ChipEnZona
                      key={clave}
                      etiqueta={medida.etiqueta}
                      onQuitar={() => quitarMedida(clave)}
                    />
                  );
                })}
              </ZonaSoltable>

              {medidasDisponibles.length > 0 && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--color-texto-suave)" }}
                  >
                    Medidas disponibles
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {medidasDisponibles.map((m) => (
                      <ChipArrastrable
                        key={m.clave}
                        id={`medida-${m.clave}`}
                        etiqueta={m.etiqueta}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  );
}
