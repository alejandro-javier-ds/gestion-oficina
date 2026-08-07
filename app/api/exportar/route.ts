// app/api/exportar/route.ts
// Genera un Excel con 3 hojas.

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import db from "@/lib/db";
import { leerSesionActual } from "@/lib/auth";

type FilaDetalleCruda = {
  fecha_hora: string;
  gestor: string;
  funcionario: string | null;
  cliente: string;
  idc: string;
  telefono: string | null;
  segmentacion: string | null;
  categoria: string | null;
  codigo_razon: string | null;
  monto_pagado: number | null;
  moneda_monto_pagado: string | null;
  observacion: string | null;
  mtodeuda_sol: number | null;
  diasmora: number | null;
  rango_mora: string | null;
  descproducto: string | null;
  estado_cartera: string | null;
  etapa_procesal: string | null;
  prioridad: string | null;
  direccion: string | null;
  distrito: string | null;
  departamento: string | null;
  router: string | null;
  nivel_riesgo: string | null;
  provincia: string | null;
  expediente: string | null;
  tipo_juicio: string | null;
  nro_juicio: string | null;
  fec_demanda: string | null;
  supervisor_procesal: string | null;
  analista_procesal: string | null;
  fec_entrega_legajo_a_estudio: string | null;
  n_garantias: number;
  valor_garantias: number;
  promesas_vigentes: number;
  promesas_cumplidas: number;
  promesas_rotas: number;
  citas_pendientes: number;
};

type FilaResumenRaw = {
  dia: string;
  gestor: string;
  funcionario: string;
  gestionesRealizadas: number;
  clientesDistintosConTat: number;
  promesasCreadas: number;
  promesasCumplidas: number;
  citasAgendadas: number;
};

type FilaPromesaCruda = {
  fecha_hora: string;
  cliente: string | null;
  idc: string;
  gestor: string;
  codcuentacobranza: string;
  tipo: string;
  moneda: string;
  monto_deuda_total: number | null;
  monto_prometido: number | null;
  monto_dolares: number | null;
  modalidad_pago: string | null;
  tipo_negociacion: string | null;
  beneficio: string | null;
  status_pdp: string | null;
  status_pago: string | null;
  numero_cuotas_aprobadas: number | null;
  estudio: string | null;
  matriz: string | null;
  estado: string;
  fecha_promesa: string;
  observacion: string | null;
};

type FilaCarteraPorGestor = { gestor: string; total: number };

const COLOR_ENCABEZADO = "FF0F766E";
const COLOR_TEXTO_ENCABEZADO = "FFFFFFFF";
const COLOR_FILA_PAR = "FFF0FDFA";
const COLOR_FILA_IMPAR = "FFFFFFFF";
const COLOR_BORDE = "FFD1D5DB";

const JOIN_CUENTA_REPRESENTATIVA = `
  JOIN cuentas c ON c.codcuentacobranza = COALESCE(
    g.codcuentacobranza,
    (SELECT codcuentacobranza FROM cuentas cc WHERE cc.idc = g.idc AND cc.activo = 1 ORDER BY cc.mtodeuda_sol DESC LIMIT 1)
  )
`;

const SUBCONSULTAS_RESUMEN = `
  (SELECT COUNT(*) FROM garantias ga WHERE ga.idc = g.idc AND ga.activo = 1) as n_garantias,
  (SELECT COALESCE(SUM(ga.monto_realizacion), 0) FROM garantias ga WHERE ga.idc = g.idc AND ga.activo = 1) as valor_garantias,
  (SELECT COUNT(*) FROM promesas_pago pp WHERE pp.idc = g.idc AND pp.estado = 'vigente') as promesas_vigentes,
  (SELECT COUNT(*) FROM promesas_pago pp WHERE pp.idc = g.idc AND pp.estado = 'cumplida') as promesas_cumplidas,
  (SELECT COUNT(*) FROM promesas_pago pp WHERE pp.idc = g.idc AND pp.estado = 'rota') as promesas_rotas,
  (SELECT COUNT(*) FROM citas ci WHERE ci.idc = g.idc AND ci.estado = 'pendiente') as citas_pendientes
`;

function estiloEncabezado(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: COLOR_TEXTO_ENCABEZADO }, size: 11 },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_ENCABEZADO },
    },
    alignment: { vertical: "middle", horizontal: "left", wrapText: false },
    border: {
      bottom: { style: "thin", color: { argb: COLOR_BORDE } },
    },
  };
}

function formatearFechaHoraLima(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(fecha)
    .replace(", ", " ");
}

function construirHoja(
  libro: ExcelJS.Workbook,
  nombreHoja: string,
  columnas: { header: string; key: string; width: number }[],
  filas: Record<string, any>[],
) {
  const hoja = libro.addWorksheet(nombreHoja, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  hoja.columns = columnas;
  hoja.getRow(1).height = 20;

  hoja.getRow(1).eachCell((celda) => {
    celda.style = estiloEncabezado();
  });

  filas.forEach((fila, i) => {
    const filaExcel = hoja.addRow(fila);
    const colorFondo = i % 2 === 0 ? COLOR_FILA_PAR : COLOR_FILA_IMPAR;
    filaExcel.eachCell((celda) => {
      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorFondo },
      };
      celda.border = {
        bottom: { style: "thin", color: { argb: COLOR_BORDE } },
      };
      celda.alignment = { horizontal: "left" };
    });
  });

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: filas.length + 1, column: columnas.length },
  };

  return hoja;
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  const desde = request.nextUrl.searchParams.get("desde");
  const hasta = request.nextUrl.searchParams.get("hasta");

  const condicionFecha =
    desde && hasta ? "AND date(g.fecha_hora) BETWEEN ? AND ?" : "";
  const parametrosFecha = desde && hasta ? [desde, hasta] : [];

  const condicionFechaPromesa =
    desde && hasta ? "AND date(pp.fecha_hora) BETWEEN ? AND ?" : "";
  const parametrosFechaPromesa = desde && hasta ? [desde, hasta] : [];

  const detalleCrudo = db
    .prepare(
      `SELECT
         g.fecha_hora,
         g.usuario_gestor_oficina as gestor,
         c.funcionario,
         c.cliente,
         g.idc,
         g.telefono,
         g.segmentacion,
         g.categoria,
         g.codigo_razon,
         g.monto_pagado,
         g.moneda_monto_pagado,
         g.observacion,
         c.mtodeuda_sol,
         c.diasmora,
         c.rango_mora,
         c.descproducto,
         c.estado_cartera,
         c.etapa_procesal,
         c.prioridad,
         c.direccion,
         c.distrito,
         c.departamento,
         c.router,
         c.nivel_riesgo,
         c.provincia,
         c.expediente,
         c.tipo_juicio,
         c.nro_juicio,
         c.fec_demanda,
         c.supervisor_procesal,
         c.analista_procesal,
         c.fec_entrega_legajo_a_estudio,
         ${SUBCONSULTAS_RESUMEN}
       FROM gestiones g
       ${JOIN_CUENTA_REPRESENTATIVA}
       WHERE (g.categoria IS NULL OR g.categoria != 'PDP') ${condicionFecha}
       ORDER BY g.fecha_hora DESC`,
    )
    .all(...parametrosFecha) as FilaDetalleCruda[];

  const detalle = detalleCrudo.map((d) => ({
    ...d,
    fecha_hora: formatearFechaHoraLima(d.fecha_hora),
  }));

  const carteraPorGestor = db
    .prepare(
      `SELECT gestor, COUNT(DISTINCT idc) as total
       FROM cuentas
       WHERE activo = 1 AND gestor IS NOT NULL
       GROUP BY gestor`,
    )
    .all() as FilaCarteraPorGestor[];
  const mapaCartera = new Map(carteraPorGestor.map((f) => [f.gestor, f.total]));

  const resumenCrudo = db
    .prepare(
      `SELECT
         date(g.fecha_hora) as dia,
         g.usuario_gestor_oficina as gestor,
         c.funcionario as funcionario,
         COUNT(*) as gestionesRealizadas,
         COUNT(DISTINCT CASE WHEN g.categoria = 'TAT' THEN g.idc END) as clientesDistintosConTat,
         (SELECT COUNT(*) FROM promesas_pago pp
            WHERE pp.usuario_gestor_oficina = g.usuario_gestor_oficina
              AND date(pp.fecha_hora) = date(g.fecha_hora)) as promesasCreadas,
         (SELECT COUNT(*) FROM promesas_pago pp
            WHERE pp.usuario_gestor_oficina = g.usuario_gestor_oficina
              AND date(pp.fecha_hora) = date(g.fecha_hora)
              AND pp.estado = 'cumplida') as promesasCumplidas,
         (SELECT COUNT(*) FROM citas ci
            WHERE ci.usuario_gestor_oficina = g.usuario_gestor_oficina
              AND date(ci.fecha_hora) = date(g.fecha_hora)) as citasAgendadas
       FROM gestiones g
       ${JOIN_CUENTA_REPRESENTATIVA}
       WHERE (g.categoria IS NULL OR g.categoria != 'PDP') ${condicionFecha}
       GROUP BY date(g.fecha_hora), g.usuario_gestor_oficina, c.funcionario
       ORDER BY dia DESC, gestor ASC`,
    )
    .all(...parametrosFecha) as FilaResumenRaw[];

  const promesasCrudas = db
    .prepare(
      `SELECT
         pp.fecha_hora,
         (SELECT cliente FROM cuentas c WHERE c.idc = pp.idc AND c.activo = 1 LIMIT 1) as cliente,
         pp.idc,
         pp.usuario_gestor_oficina as gestor,
         pp.codcuentacobranza,
         pp.tipo,
         pp.moneda,
         pp.monto_deuda_total,
         pp.monto_prometido,
         pp.monto_dolares,
         pp.modalidad_pago,
         pp.tipo_negociacion,
         pp.beneficio,
         pp.status_pdp,
         pp.status_pago,
         pp.numero_cuotas_aprobadas,
         pp.estudio,
         pp.matriz,
         pp.estado,
         pp.fecha_promesa,
         pp.observacion
       FROM promesas_pago pp
       WHERE 1=1 ${condicionFechaPromesa}
       ORDER BY pp.fecha_hora DESC`,
    )
    .all(...parametrosFechaPromesa) as FilaPromesaCruda[];

  const hoy = new Date().toISOString().slice(0, 10);
  const promesasConVencida = promesasCrudas.map((p) => ({
    ...p,
    fecha_hora: formatearFechaHoraLima(p.fecha_hora),
    vencida: p.estado === "vigente" && p.fecha_promesa < hoy ? "Sí" : "No",
  }));

  const libro = new ExcelJS.Workbook();
  libro.creator = "Gestión de Oficina — Estudio Caillaux";
  libro.created = new Date();

  construirHoja(
    libro,
    "Detalle de Gestiones",
    [
      { header: "Fecha y Hora", key: "fecha_hora", width: 22 },
      { header: "Gestor", key: "gestor", width: 24 },
      { header: "Funcionario", key: "funcionario", width: 24 },
      { header: "Cliente", key: "cliente", width: 34 },
      { header: "IDC", key: "idc", width: 14 },
      { header: "Teléfono", key: "telefono", width: 18 },
      { header: "Segmentación", key: "segmentacion", width: 26 },
      { header: "Categoría", key: "categoria", width: 16 },
      { header: "Código de Razón", key: "codigo_razon", width: 30 },
      { header: "Moneda Monto Pagado", key: "moneda_monto_pagado", width: 22 },
      { header: "Monto Pagado", key: "monto_pagado", width: 18 },
      { header: "Observación", key: "observacion", width: 42 },
      { header: "Monto Deuda (S/)", key: "mtodeuda_sol", width: 20 },
      { header: "Días Mora", key: "diasmora", width: 15 },
      { header: "Rango de Mora", key: "rango_mora", width: 18 },
      { header: "Producto", key: "descproducto", width: 22 },
      { header: "Estado de Cartera", key: "estado_cartera", width: 20 },
      { header: "Etapa Procesal", key: "etapa_procesal", width: 22 },
      { header: "Prioridad", key: "prioridad", width: 15 },
      { header: "Dirección", key: "direccion", width: 32 },
      { header: "Distrito", key: "distrito", width: 18 },
      { header: "Departamento", key: "departamento", width: 18 },
      { header: "Router", key: "router", width: 15 },
      { header: "Nivel de Riesgo", key: "nivel_riesgo", width: 20 },
      { header: "Provincia", key: "provincia", width: 18 },
      { header: "Expediente", key: "expediente", width: 22 },
      { header: "Tipo de Juicio", key: "tipo_juicio", width: 24 },
      { header: "N° Juicio", key: "nro_juicio", width: 16 },
      { header: "Fecha de Demanda", key: "fec_demanda", width: 18 },
      { header: "Supervisor Procesal", key: "supervisor_procesal", width: 24 },
      { header: "Analista Procesal", key: "analista_procesal", width: 24 },
      {
        header: "Fecha Entrega Legajo a Estudio",
        key: "fec_entrega_legajo_a_estudio",
        width: 26,
      },
      { header: "N° Garantías", key: "n_garantias", width: 16 },
      { header: "Valor Garantías (S/)", key: "valor_garantias", width: 20 },
      { header: "Promesas Vigentes", key: "promesas_vigentes", width: 18 },
      { header: "Promesas Cumplidas", key: "promesas_cumplidas", width: 18 },
      { header: "Promesas Rotas", key: "promesas_rotas", width: 16 },
      { header: "Citas Pendientes", key: "citas_pendientes", width: 16 },
    ],
    detalle,
  );

  construirHoja(
    libro,
    "Resumen de Indicadores",
    [
      { header: "Fecha", key: "dia", width: 16 },
      { header: "Gestor", key: "gestor", width: 24 },
      { header: "Funcionario", key: "funcionario", width: 24 },
      { header: "Gestiones Realizadas", key: "gestionesRealizadas", width: 24 },
      {
        header: "Clientes Distintos con Contacto Directo",
        key: "clientesDistintosConTat",
        width: 34,
      },
      { header: "Intensidad Diaria", key: "intensidadDiaria", width: 20 },
      {
        header: "Contactabilidad Diaria (%)",
        key: "contactabilidadDiaria",
        width: 28,
      },
      { header: "Promesas Creadas", key: "promesasCreadas", width: 20 },
      {
        header: "Promesas Cumplidas (%)",
        key: "promesasCumplidasPorcentaje",
        width: 24,
      },
      { header: "Citas Agendadas", key: "citasAgendadas", width: 20 },
    ],
    resumenCrudo.map((f) => {
      const totalCartera = mapaCartera.get(f.gestor) ?? 0;
      return {
        dia: f.dia,
        gestor: f.gestor,
        funcionario: f.funcionario,
        gestionesRealizadas: f.gestionesRealizadas,
        clientesDistintosConTat: f.clientesDistintosConTat,
        intensidadDiaria:
          totalCartera > 0
            ? Number((f.gestionesRealizadas / totalCartera).toFixed(3))
            : 0,
        contactabilidadDiaria:
          totalCartera > 0
            ? Number(
              ((f.clientesDistintosConTat / totalCartera) * 100).toFixed(1),
            )
            : 0,
        promesasCreadas: f.promesasCreadas,
        promesasCumplidasPorcentaje:
          f.promesasCreadas > 0
            ? Number(
              ((f.promesasCumplidas / f.promesasCreadas) * 100).toFixed(1),
            )
            : 0,
        citasAgendadas: f.citasAgendadas,
      };
    }),
  );

  construirHoja(
    libro,
    "Promesas de Pago",
    [
      { header: "Estudio", key: "estudio", width: 20 },
      { header: "Matriz", key: "matriz", width: 14 },
      { header: "Fecha y Hora", key: "fecha_hora", width: 22 },
      { header: "Cliente", key: "cliente", width: 34 },
      { header: "IDC", key: "idc", width: 14 },
      { header: "Gestor", key: "gestor", width: 24 },
      { header: "Cuenta de Cobranza", key: "codcuentacobranza", width: 26 },
      { header: "Tipo de Promesa", key: "tipo", width: 30 },
      { header: "Moneda", key: "moneda", width: 14 },
      { header: "Monto de la Deuda", key: "monto_deuda_total", width: 20 },
      { header: "Monto Prometido", key: "monto_prometido", width: 20 },
      {
        header: "Monto Prometido ($, referencial)",
        key: "monto_dolares",
        width: 26,
      },
      { header: "Modalidad de Pago", key: "modalidad_pago", width: 28 },
      { header: "Tipo de Negociación", key: "tipo_negociacion", width: 26 },
      { header: "Beneficio", key: "beneficio", width: 18 },
      { header: "Status PDP", key: "status_pdp", width: 18 },
      { header: "Status Pago", key: "status_pago", width: 16 },
      {
        header: "N° de Cuotas Aprobadas",
        key: "numero_cuotas_aprobadas",
        width: 22,
      },
      { header: "Estado", key: "estado", width: 16 },
      { header: "Vencida", key: "vencida", width: 12 },
      { header: "Fecha de Vencimiento", key: "fecha_promesa", width: 20 },
      { header: "Observación", key: "observacion", width: 42 },
    ],
    promesasConVencida,
  );

  const buffer = Buffer.from(await libro.xlsx.writeBuffer());
  const nombreArchivo = `gestiones_${new Date().toISOString().slice(0, 10)}.xlsx`;

  if (sesion) {
    db.prepare(
      "INSERT INTO exportaciones (fecha_hora, usuario) VALUES (?, ?)",
    ).run(new Date().toISOString(), sesion.nombreCompleto);
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
