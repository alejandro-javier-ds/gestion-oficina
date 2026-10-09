// app/api/whatsapp/pdps/route.ts
//
// Obtiene clientes PDP para WhatsApp Masivo.
//
// Filtros:
// - Status PDP
// - rango de fecha
// - gestor
// - búsqueda
//
// La fecha utilizada para el rango es
// promesas_pago.fecha_hora.

import { NextRequest, NextResponse } from "next/server";

import { consultarFilas } from "@/lib/postgres";

import { leerSesionActual } from "@/lib/auth";

export const runtime = "nodejs";

type StatusPdp = "Posible Pago" | "100% Confiable" | "Fin de Acuerdo";

const ROLES_PERMITIDOS = ["administrador", "supervisor", "gestor"];

const STATUS_VALIDOS: StatusPdp[] = [
  "Posible Pago",
  "100% Confiable",
  "Fin de Acuerdo",
];

type FilaPdp = {
  id: number;
  idc: string;
  codcuentacobranza: string;
  cliente: string;
  gestor: string | null;
  tipo: string;
  moneda: string;
  monto_prometido: number | null;
  monto_dolares: number | null;
  fecha_promesa: string;
  estado: string;
  status_pdp: string | null;
  fecha_hora: string;
};

type TelefonoPdp = {
  id_phone: number;
  idc: string;
  phone: string;
  tipo_telefono: string;
  activo: number;
  qtty_phone_ranking: number | null;
};

function normalizarFecha(valor: string | null): string {
  if (!valor) {
    return "";
  }

  return valor.slice(0, 10);
}

function normalizarNumero(valor: string | null): string {
  if (!valor) {
    return "";
  }

  return valor.replace(/\D/g, "").replace(/^51/, "").slice(0, 9);
}

async function obtenerTelefonos(
  idcs: string[],
): Promise<Map<string, TelefonoPdp[]>> {
  const resultado = new Map<string, TelefonoPdp[]>();

  for (const idc of idcs) {
    resultado.set(idc, []);
  }

  if (idcs.length === 0) {
    return resultado;
  }

  const filas = await consultarFilas<TelefonoPdp>(
    `
        SELECT
          id_phone::int
            AS id_phone,

          idc,
          phone,
          tipo_telefono,

          activo::int
            AS activo,

          qtty_phone_ranking

        FROM telefonos

        WHERE
          idc = ANY(
            $1::text[]
          )

          AND activo = 1

        ORDER BY
          idc,
          qtty_phone_ranking DESC,
          id_phone ASC
      `,
    [idcs],
  );

  for (const telefono of filas) {
    const actuales = resultado.get(telefono.idc) ?? [];

    actuales.push(telefono);

    resultado.set(telefono.idc, actuales);
  }

  return resultado;
}

export async function GET(request: NextRequest) {
  const sesion = await leerSesionActual();

  if (!sesion) {
    return NextResponse.json(
      {
        error: "No autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  if (!ROLES_PERMITIDOS.includes(sesion.rol)) {
    return NextResponse.json(
      {
        error: "Tu rol no tiene permiso para este módulo.",
      },
      {
        status: 403,
      },
    );
  }

  const params = request.nextUrl.searchParams;

  const statusParam = params.get("statusPdp");

  const desde = params.get("desde")?.trim() ?? "";

  const hasta = params.get("hasta")?.trim() ?? "";

  const gestorParam = params.get("gestor")?.trim() ?? "";

  const busqueda = params.get("q")?.trim().toLowerCase() ?? "";

  if (statusParam && !STATUS_VALIDOS.includes(statusParam as StatusPdp)) {
    return NextResponse.json(
      {
        error: "Status PDP inválido.",
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
    sesion.rol === "gestor"
      ? (sesion.gestor?.trim() ?? "")
      : gestorParam === "Miguel Rodriguez"
        ? ""
        : gestorParam;

  const condiciones: string[] = ["c.activo = 1", "p.status_pdp IS NOT NULL"];

  const valores: unknown[] = [];

  function agregarParametro(valor: unknown): string {
    valores.push(valor);

    return `$${valores.length}`;
  }

  if (statusParam) {
    const parametro = agregarParametro(statusParam);

    condiciones.push(`p.status_pdp = ${parametro}`);
  }

  if (desde) {
    const parametro = agregarParametro(desde);

    condiciones.push(
      `
        LEFT(
          p.fecha_hora::text,
          10
        ) >= ${parametro}
      `,
    );
  }

  if (hasta) {
    const parametro = agregarParametro(hasta);

    condiciones.push(
      `
        LEFT(
          p.fecha_hora::text,
          10
        ) <= ${parametro}
      `,
    );
  }

  if (gestorFiltro) {
    const parametro = agregarParametro(gestorFiltro);

    condiciones.push(`c.gestor = ${parametro}`);
  }

  condiciones.push(`
    p.id = (
      SELECT
        p2.id

      FROM promesas_pago p2

      WHERE
        p2.idc = p.idc

      ORDER BY
        p2.fecha_hora DESC,
        p2.id DESC

      LIMIT 1
    )
  `);

  try {
    const filas = await consultarFilas<FilaPdp>(
      `
          SELECT
            p.id::int
              AS id,

            p.idc,
            p.codcuentacobranza,
            c.cliente,
            c.gestor,
            p.tipo,
            p.moneda,
            p.monto_prometido,
            p.monto_dolares,
            p.fecha_promesa,
            p.estado,
            p.status_pdp,
            p.fecha_hora

          FROM promesas_pago p

          INNER JOIN cuentas c
            ON c.idc = p.idc

          WHERE
            ${condiciones.join(" AND ")}

          ORDER BY
            p.fecha_hora DESC,
            p.id DESC
        `,
      valores,
    );

    const idcs = Array.from(new Set(filas.map((fila) => fila.idc)));

    const telefonos = await obtenerTelefonos(idcs);

    let clientes = filas
      .map((fila) => {
        const telefonosCliente = telefonos.get(fila.idc) ?? [];

        const celular =
          telefonosCliente.find(
            (telefono) => telefono.tipo_telefono.toLowerCase() === "celular",
          ) ??
          telefonosCliente[0] ??
          null;

        return {
          id: String(fila.id),

          idc: fila.idc,

          cliente: fila.cliente,

          gestor: fila.gestor,

          statusPdp: fila.status_pdp,

          tipo: fila.tipo,

          moneda: fila.moneda,

          montoPdp: fila.monto_prometido,

          montoDolares: fila.monto_dolares,

          fechaPdp: normalizarFecha(fila.fecha_promesa),

          estadoPdp: fila.estado,

          fechaRegistro: fila.fecha_hora,

          telefonos: telefonosCliente,

          telefonoPredeterminado: celular
            ? normalizarNumero(celular.phone)
            : "",
        };
      })
      .filter((cliente) => {
        if (!busqueda) {
          return true;
        }

        const texto = [
          cliente.idc,
          cliente.cliente,
          cliente.gestor ?? "",
          cliente.statusPdp ?? "",
          cliente.telefonoPredeterminado,

          ...cliente.telefonos.map((telefono) => telefono.phone),
        ]
          .join(" ")
          .toLowerCase();

        return texto.includes(busqueda);
      });

    clientes = Array.from(
      new Map(clientes.map((cliente) => [cliente.idc, cliente])).values(),
    );

    return NextResponse.json({
      statusPdp: statusParam ?? null,

      desde: desde || null,

      hasta: hasta || null,

      gestor: gestorFiltro || null,

      total: clientes.length,

      clientes,
    });
  } catch (error) {
    console.error("Error consultando PDPs WhatsApp:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar las PDP.",
      },
      {
        status: 500,
      },
    );
  }
}
