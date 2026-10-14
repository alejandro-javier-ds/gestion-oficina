// app/api/whatsapp/exportar-mensajes/route.ts
//
// Exporta exclusivamente el historial
// de campañas de WhatsApp Masivo.
//
// Hojas:
// - Gestiones
// - PDPs

import { NextRequest, NextResponse } from "next/server";

import ExcelJS from "exceljs";

import { consultarFilas } from "@/lib/postgres";

import { requerirAccesoApi } from "@/lib/api-acceso";
import { fechaActualLima } from "@/lib/fecha-lima";

export const runtime = "nodejs";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "abogado", "gestor"] as const;

const COLOR_ENCABEZADO = "FF0F766E";

const COLOR_TEXTO = "FFFFFFFF";

const COLOR_PAR = "FFF0FDFA";

const COLOR_IMPAR = "FFFFFFFF";

const COLOR_BORDE = "FFD1D5DB";

type FilaExportacion = {
  fecha_creacion: string;
  usuario_creador: string | null;
  campana: string;
  gestor: string | null;
  desde: string;
  hasta: string;
  numero_salida: string;

  total_seleccionados: number;
  total_preparados: number;
  total_sin_telefono: number;
  total_fallidos: number;
  total_enviados: number;

  estado: string;

  cliente: string | null;
  idc: string;

  telefono_destino: string | null;
  tipo_telefono: string | null;

  estado_destinatario: string;

  error: string | null;
  mensaje: string | null;

  status_pdp: string | null;
  monto_pdp: number | null;
  moneda_pdp: string | null;
  fecha_pdp: string | null;
};

function formatearFechaHoraLima(valor: string): string {
  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return valor;
  }

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

function formatearFecha(valor: string | null): string {
  if (!valor) {
    return "";
  }

  return valor.slice(0, 10);
}

function esPdp(campana: string): boolean {
  return campana.trim().toUpperCase().startsWith("PDP");
}

function estiloEncabezado(): Partial<ExcelJS.Style> {
  return {
    font: {
      bold: true,

      color: {
        argb: COLOR_TEXTO,
      },

      size: 11,
    },

    fill: {
      type: "pattern",

      pattern: "solid",

      fgColor: {
        argb: COLOR_ENCABEZADO,
      },
    },

    alignment: {
      vertical: "middle",

      horizontal: "left",
    },

    border: {
      bottom: {
        style: "thin",

        color: {
          argb: COLOR_BORDE,
        },
      },
    },
  };
}

function construirHoja(
  libro: ExcelJS.Workbook,
  nombre: string,
  filas: Record<string, unknown>[],
  columnas: {
    header: string;
    key: string;
    width: number;
  }[],
) {
  const hoja = libro.addWorksheet(nombre, {
    views: [
      {
        state: "frozen",

        ySplit: 1,
      },
    ],
  });

  hoja.columns = columnas;

  hoja.getRow(1).height = 22;

  hoja.getRow(1).eachCell((celda) => {
    celda.style = estiloEncabezado();
  });

  filas.forEach((fila, indice) => {
    const filaExcel = hoja.addRow(fila);

    const fondo = indice % 2 === 0 ? COLOR_PAR : COLOR_IMPAR;

    filaExcel.eachCell((celda) => {
      celda.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: fondo,
        },
      };

      celda.border = {
        bottom: {
          style: "thin",

          color: {
            argb: COLOR_BORDE,
          },
        },
      };

      celda.alignment = {
        vertical: "top",

        wrapText: false,
      };
    });
  });

  hoja.autoFilter = {
    from: {
      row: 1,

      column: 1,
    },

    to: {
      row: filas.length + 1,

      column: columnas.length,
    },
  };

  return hoja;
}

export async function GET(request: NextRequest) {
  const acceso = await requerirAccesoApi(ROLES_PERMITIDOS);
  if (!acceso.ok) return acceso.respuesta;
  const sesion = acceso.sesion;

  const params = request.nextUrl.searchParams;

  const desde = params.get("desde")?.trim() ?? "";

  const hasta = params.get("hasta")?.trim() ?? "";

  const gestor = params.get("gestor")?.trim() ?? "";

  const incluirGestiones = params.get("gestiones") === "1";

  const incluirPdp = params.get("pdps") === "1";

  if (!incluirGestiones && !incluirPdp) {
    return NextResponse.json(
      {
        error: "Selecciona al menos una hoja.",
      },
      {
        status: 400,
      },
    );
  }

  if (desde && hasta && desde > hasta) {
    return NextResponse.json(
      {
        error: "La fecha desde no puede ser posterior a la fecha hasta.",
      },
      {
        status: 400,
      },
    );
  }

  const gestorFiltro =
    sesion.rol === "gestor" ? (sesion.gestor?.trim() ?? "") : gestor;

  if (sesion.rol === "gestor" && !gestorFiltro) {
    return NextResponse.json(
      { error: "No tienes una cartera asignada para consultar campañas." },
      { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const condiciones: string[] = [];

  const valores: unknown[] = [];

  function agregarParametro(valor: unknown): string {
    valores.push(valor);

    return `$${valores.length}`;
  }

  if (desde) {
    const parametro = agregarParametro(desde);

    condiciones.push(`
      LEFT(
        c.fecha_creacion::text,
        10
      ) >= ${parametro}
    `);
  }

  if (hasta) {
    const parametro = agregarParametro(hasta);

    condiciones.push(`
      LEFT(
        c.fecha_creacion::text,
        10
      ) <= ${parametro}
    `);
  }

  if (gestorFiltro) {
    const parametro = agregarParametro(gestorFiltro);

    condiciones.push(`c.gestor = ${parametro}`);
  }

  const where =
    condiciones.length > 0
      ? `
        WHERE
          ${condiciones.join(" AND ")}
      `
      : "";

  try {
    const filas = await consultarFilas<FilaExportacion>(
      `
          SELECT
            c.fecha_creacion,
            c.usuario_creador,
            c.campana,
            c.gestor,
            c.desde,
            c.hasta,
            c.numero_salida,

            c.total_seleccionados::int
              AS total_seleccionados,

            c.total_preparados::int
              AS total_preparados,

            c.total_sin_telefono::int
              AS total_sin_telefono,

            c.total_fallidos::int
              AS total_fallidos,

            c.total_enviados::int
              AS total_enviados,

            c.estado,

            d.cliente,
            d.idc,
            d.telefono_destino,
            d.tipo_telefono,

            d.estado
              AS estado_destinatario,

            d.error,
            d.mensaje,

            d.status_pdp,
            d.monto_pdp,
            d.moneda_pdp,
            d.fecha_pdp

          FROM whatsapp_campanas c

          INNER JOIN
            whatsapp_campana_destinatarios d
            ON
              d.campana_id =
              c.id

          ${where}

          ORDER BY
            c.fecha_creacion DESC,
            d.id ASC
        `,
      valores,
    );

    const filasPdp = filas.filter((fila) => esPdp(fila.campana));

    const filasGestiones = filas.filter((fila) => !esPdp(fila.campana));

    const libro = new ExcelJS.Workbook();

    libro.creator = "Gestión de Oficina — Estudio Caillaux";

    libro.created = new Date();

    if (incluirGestiones) {
      const datosGestiones = filasGestiones.map((fila) => ({
        "Fecha campaña": formatearFechaHoraLima(fila.fecha_creacion),

        Usuario: fila.usuario_creador ?? "",

        Campaña: fila.campana,

        Gestor: fila.gestor ?? "",

        Desde: fila.desde,

        Hasta: fila.hasta,

        "Número de salida": fila.numero_salida,

        Cliente: fila.cliente ?? "",

        IDC: fila.idc,

        "Teléfono destino": fila.telefono_destino ?? "",

        "Tipo teléfono": fila.tipo_telefono ?? "",

        Estado: fila.estado_destinatario,

        Error: fila.error ?? "",

        Mensaje: fila.mensaje ?? "",
      }));

      construirHoja(libro, "Gestiones", datosGestiones, [
        {
          header: "Fecha campaña",

          key: "Fecha campaña",

          width: 22,
        },
        {
          header: "Usuario",

          key: "Usuario",

          width: 26,
        },
        {
          header: "Campaña",

          key: "Campaña",

          width: 30,
        },
        {
          header: "Gestor",

          key: "Gestor",

          width: 26,
        },
        {
          header: "Desde",

          key: "Desde",

          width: 14,
        },
        {
          header: "Hasta",

          key: "Hasta",

          width: 14,
        },
        {
          header: "Número de salida",

          key: "Número de salida",

          width: 20,
        },
        {
          header: "Cliente",

          key: "Cliente",

          width: 38,
        },
        {
          header: "IDC",

          key: "IDC",

          width: 18,
        },
        {
          header: "Teléfono destino",

          key: "Teléfono destino",

          width: 20,
        },
        {
          header: "Tipo teléfono",

          key: "Tipo teléfono",

          width: 18,
        },
        {
          header: "Estado",

          key: "Estado",

          width: 20,
        },
        {
          header: "Error",

          key: "Error",

          width: 36,
        },
        {
          header: "Mensaje",

          key: "Mensaje",

          width: 80,
        },
      ]);
    }

    if (incluirPdp) {
      const datosPdp = filasPdp.map((fila) => ({
        "Fecha campaña": formatearFechaHoraLima(fila.fecha_creacion),

        Usuario: fila.usuario_creador ?? "",

        Campaña: fila.campana,

        Gestor: fila.gestor ?? "",

        Desde: fila.desde,

        Hasta: fila.hasta,

        "Número de salida": fila.numero_salida,

        Cliente: fila.cliente ?? "",

        IDC: fila.idc,

        "Status PDP": fila.status_pdp ?? "",

        "Monto PDP": fila.monto_pdp ?? "",

        Moneda: fila.moneda_pdp ?? "",

        "Fecha PDP": formatearFecha(fila.fecha_pdp),

        "Teléfono destino": fila.telefono_destino ?? "",

        "Tipo teléfono": fila.tipo_telefono ?? "",

        Estado: fila.estado_destinatario,

        Error: fila.error ?? "",

        Mensaje: fila.mensaje ?? "",
      }));

      construirHoja(libro, "PDPs", datosPdp, [
        {
          header: "Fecha campaña",

          key: "Fecha campaña",

          width: 22,
        },
        {
          header: "Usuario",

          key: "Usuario",

          width: 26,
        },
        {
          header: "Campaña",

          key: "Campaña",

          width: 24,
        },
        {
          header: "Gestor",

          key: "Gestor",

          width: 26,
        },
        {
          header: "Desde",

          key: "Desde",

          width: 14,
        },
        {
          header: "Hasta",

          key: "Hasta",

          width: 14,
        },
        {
          header: "Número de salida",

          key: "Número de salida",

          width: 20,
        },
        {
          header: "Cliente",

          key: "Cliente",

          width: 38,
        },
        {
          header: "IDC",

          key: "IDC",

          width: 18,
        },
        {
          header: "Status PDP",

          key: "Status PDP",

          width: 22,
        },
        {
          header: "Monto PDP",

          key: "Monto PDP",

          width: 18,
        },
        {
          header: "Moneda",

          key: "Moneda",

          width: 14,
        },
        {
          header: "Fecha PDP",

          key: "Fecha PDP",

          width: 18,
        },
        {
          header: "Teléfono destino",

          key: "Teléfono destino",

          width: 20,
        },
        {
          header: "Tipo teléfono",

          key: "Tipo teléfono",

          width: 18,
        },
        {
          header: "Estado",

          key: "Estado",

          width: 20,
        },
        {
          header: "Error",

          key: "Error",

          width: 36,
        },
        {
          header: "Mensaje",

          key: "Mensaje",

          width: 80,
        },
      ]);
    }

    const buffer = await libro.xlsx.writeBuffer();

    const archivo = new Uint8Array(buffer);

    const fecha = fechaActualLima();

    const nombre = `exportar_mensajes_whatsapp_${fecha}.xlsx`;

    return new NextResponse(archivo, {
      status: 200,

      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "Content-Disposition": `attachment; filename="${nombre}"`,

        "Content-Length": String(archivo.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error exportando mensajes WhatsApp:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo exportar el historial de WhatsApp.",
      },
      {
        status: 500,
      },
    );
  }
}
