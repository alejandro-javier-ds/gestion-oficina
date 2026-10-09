// lib/importar-cuentas.ts
// Importa la hoja "Cuentas" del portafolio.
//
// PostgreSQL + ExcelJS.
//
// La hoja Cuentas es la fuente principal de la cartera:
// se reconoce la cartera y sus responsables a partir de cuentas existentes;
// después, a partir de esas cuentas,
// quedan definidos los IDC que utilizarán los demás importadores.

import ExcelJS from "exceljs";

import { conTransaccion } from "./postgres";

import { DESCRIPCION_ROUTER, MAPEO_CUENTAS } from "./mapeo-columnas";
import {
  buscarHojaPortafolio,
  ColumnaAdaptada,
  ErrorFormatoPortafolio,
  filasComoReferencias,
  leerHojaPortafolio,
  reconocerColumnasPorContenido,
  validarColumnasPortafolio,
} from "./portafolio-excel";
import { seleccionarFilasCartera } from "./portafolio-cartera";
import { sincronizarSecuenciaHistorial } from "./portafolio-postgres";

export type ResumenImportacion = {
  totalFilasLeidas: number;
  filasPermitidas: number;
  cuentasNuevas: number;
  cuentasActualizadas: number;
  cuentasDadasDeBaja: number;
  columnasAdaptadas: ColumnaAdaptada[];
  funcionariosReconocidos: string[];
};

type FilaExcel = Record<string, unknown>;

type CuentaExistente = FilaExcel & {
  codcuentacobranza: string;
  idc: string;
  router: string | null;
  funcionario: string | null;
  activo: number;
};

type DireccionExistente = {
  id: number;
  idc: string;
};

function limpiarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
}

function leerNroJuicio(fila: FilaExcel): string | null {
  const valor = fila["NRO_JUICIO"] ?? fila["NUMERO JUICIO"];

  if (valor === null || valor === undefined || limpiarTexto(valor) === "") {
    return null;
  }

  return String(valor);
}

function leerFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return null;
    }

    return valor.toISOString().slice(0, 10);
  }

  return String(valor);
}

function valorONull(valor: unknown): unknown {
  return valor === undefined || valor === "" ? null : valor;
}

export async function importarPortafolioDesdeBuffer(
  buffer: Buffer,
  nombreArchivo: string,
): Promise<ResumenImportacion> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const hoja = buscarHojaPortafolio(workbook, "Cuentas");

  if (!hoja) {
    throw new ErrorFormatoPortafolio(
      'El Excel no tiene una hoja llamada "Cuentas".',
    );
  }

  const lectura = leerHojaPortafolio(hoja, "Cuentas");

  const ahora = new Date().toISOString();

  const fechaHoy = ahora.slice(0, 10);

  return conTransaccion(async (cliente) => {
    await cliente.query(
      "SELECT pg_advisory_xact_lock(hashtext('importacion-portafolio'))",
    );

    const resultadoExistentes = await cliente.query<CuentaExistente>(
      `
            SELECT *
            FROM cuentas
          `,
    );

    reconocerColumnasPorContenido(
      lectura,
      filasComoReferencias(resultadoExistentes.rows, "Cuentas"),
    );
    validarColumnasPortafolio(lectura);
    const { filas, encabezados } = lectura;
    const seleccion = seleccionarFilasCartera(filas, resultadoExistentes.rows);
    const filasFiltradas = seleccion.filas;
    if (!filasFiltradas.length) {
      throw new ErrorFormatoPortafolio(
        "El portafolio no contiene cuentas reconocidas de la cartera. No se realizó ningún cambio.",
      );
    }
    for (const fila of filasFiltradas) {
      if (
        !limpiarTexto(fila["CODCUENTACOBRANZA"]) ||
        !limpiarTexto(fila["IDC"])
      ) {
        throw new ErrorFormatoPortafolio(
          "Se encontró una cuenta sin CODCUENTACOBRANZA o IDC. La importación fue cancelada.",
        );
      }
    }
    await sincronizarSecuenciaHistorial(cliente);

    const camposCuenta = Object.keys(MAPEO_CUENTAS);
    const columnasCuenta = Object.values(MAPEO_CUENTAS);
    const actualizaciones = Object.entries(MAPEO_CUENTAS)
      .filter(
        ([campo]) => campo !== "CODCUENTACOBRANZA" && encabezados.has(campo),
      )
      .map(([, columna]) => columna + " = EXCLUDED." + columna);
    actualizaciones.push(
      "activo = 1",
      "fecha_ultima_actualizacion = EXCLUDED.fecha_ultima_actualizacion",
    );

    const existentesAntes = new Set(
      resultadoExistentes.rows.map((fila) => fila.codcuentacobranza),
    );

    const cuentasExistentes = new Map<string, CuentaExistente>(
      resultadoExistentes.rows.map((fila) => [fila.codcuentacobranza, fila]),
    );

    const resultadoDirecciones = await cliente.query<DireccionExistente>(
      `
            SELECT
              id,
              idc
            FROM direcciones
            WHERE fuente = 'portafolio'
            ORDER BY id
          `,
    );

    const direccionPorIdc = new Map<string, number>();

    for (const direccion of resultadoDirecciones.rows) {
      if (!direccionPorIdc.has(direccion.idc)) {
        direccionPorIdc.set(direccion.idc, direccion.id);
      }
    }

    const codigosEnEsteImport = new Set<string>();

    const direccionesPorIdc = new Map<
      string,
      {
        direccion: string;
        distrito: string | null;
        provincia: string | null;
        departamento: string | null;
      }
    >();

    for (const fila of filasFiltradas) {
      const codigo = limpiarTexto(fila["CODCUENTACOBRANZA"]);

      const idc = limpiarTexto(fila["IDC"]);

      if (!codigo || !idc) {
        throw new Error(
          "Se encontró una cuenta permitida sin CODCUENTACOBRANZA o IDC. La importación fue cancelada.",
        );
      }

      const cuentaExistente = cuentasExistentes.get(codigo);
      const routerNuevo = encabezados.has("ROUTER")
        ? limpiarTexto(fila["ROUTER"]) || null
        : (cuentaExistente?.router ?? null);

      codigosEnEsteImport.add(codigo);

      const routerAnterior = cuentaExistente?.router ?? null;

      if (routerNuevo && routerNuevo !== routerAnterior) {
        if (routerAnterior) {
          await cliente.query(
            `
                INSERT INTO historial_router (
                  idc,
                  codcuentacobranza,
                  fecha_registro,
                  seguimiento,
                  router,
                  descripcion
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6
                )
              `,
            [
              idc,
              codigo,
              fechaHoy,
              `Fin Router Router ${routerAnterior}`,
              routerAnterior,
              DESCRIPCION_ROUTER[routerAnterior] ?? null,
            ],
          );
        }

        await cliente.query(
          `
              INSERT INTO historial_router (
                idc,
                codcuentacobranza,
                fecha_registro,
                seguimiento,
                router,
                descripcion
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6
              )
            `,
          [
            idc,
            codigo,
            fechaHoy,
            `Inicio Router Router ${routerNuevo}`,
            routerNuevo,
            DESCRIPCION_ROUTER[routerNuevo] ?? null,
          ],
        );
      }

      const datosCuenta: FilaExcel = {
        ...fila,
        CODCUENTACOBRANZA: codigo,
        IDC: idc,
        CLIENTE: limpiarTexto(fila["CLIENTE"]) || null,
        FUNCIONARIO: limpiarTexto(fila["FUNCIONARIO"]) || null,
        GESTOR: limpiarTexto(fila["GESTOR"]) || null,
        CODMONEDA: limpiarTexto(fila["CODMONEDA"]) || null,
        ROUTER: routerNuevo,
        NRO_JUICIO: leerNroJuicio(fila),
        FEC_DEMANDA: leerFecha(fila["FEC_DEMANDA"]),
        "SUPERVISOR PROCESAL":
          limpiarTexto(fila["SUPERVISOR PROCESAL"]) || null,
        "ANALISTA PROCESAL": limpiarTexto(fila["ANALISTA PROCESAL"]) || null,
        FEC_ENTREGA_LEGAJO_A_ESTUDIO: leerFecha(
          fila["FEC_ENTREGA_LEGAJO_A_ESTUDIO"],
        ),
      };
      const parametros = camposCuenta.map((campo) =>
        valorONull(datosCuenta[campo]),
      );
      parametros.push(ahora);
      await cliente.query(
        "INSERT INTO cuentas (" +
        columnasCuenta.join(", ") +
        ", activo, fecha_ultima_actualizacion) " +
        "VALUES (" +
        camposCuenta.map((_, indice) => "$" + (indice + 1)).join(", ") +
        ", 1, $" +
        parametros.length +
        ") " +
        "ON CONFLICT (codcuentacobranza) DO UPDATE SET " +
        actualizaciones.join(", "),
        parametros,
      );

      cuentasExistentes.set(codigo, {
        ...cuentaExistente,
        codcuentacobranza: codigo,
        idc,
        router: routerNuevo,
        funcionario: limpiarTexto(fila["FUNCIONARIO"]) || null,
        activo: 1,
      });

      const direccion = limpiarTexto(fila["DIRECCION"]);

      if (direccion) {
        direccionesPorIdc.set(idc, {
          direccion,
          distrito:
            limpiarTexto(
              encabezados.has("DISTRITO")
                ? fila["DISTRITO"]
                : cuentaExistente?.distrito,
            ) || null,
          provincia:
            limpiarTexto(
              encabezados.has("PROVINCIA")
                ? fila["PROVINCIA"]
                : cuentaExistente?.provincia,
            ) || null,
          departamento:
            limpiarTexto(
              encabezados.has("DEPARTAMENTO")
                ? fila["DEPARTAMENTO"]
                : cuentaExistente?.departamento,
            ) || null,
        });
      }
    }

    for (const [idc, direccion] of direccionesPorIdc) {
      const idExistente = direccionPorIdc.get(idc);

      if (idExistente !== undefined) {
        await cliente.query(
          `
              UPDATE direcciones
              SET
                direccion = $1,
                distrito = $2,
                provincia = $3,
                departamento = $4,
                fecha_modificacion = $5,
                activo = 1
              WHERE id = $6
            `,
          [
            direccion.direccion,
            direccion.distrito,
            direccion.provincia,
            direccion.departamento,
            ahora,
            idExistente,
          ],
        );
      } else {
        const nuevaDireccion = await cliente.query<{
          id: number;
        }>(
          `
                INSERT INTO direcciones (
                  idc,
                  direccion,
                  distrito,
                  provincia,
                  departamento,
                  tipo,
                  fuente,
                  fecha_modificacion,
                  activo
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  'Domicilio',
                  'portafolio',
                  $6,
                  1
                )
                RETURNING id
              `,
          [
            idc,
            direccion.direccion,
            direccion.distrito,
            direccion.provincia,
            direccion.departamento,
            ahora,
          ],
        );

        direccionPorIdc.set(idc, nuevaDireccion.rows[0].id);
      }
    }

    const codigosActuales = [...codigosEnEsteImport];

    const resultadoBajas = await cliente.query(
      `
            UPDATE cuentas
            SET activo = 0
            WHERE activo = 1
              AND NOT (
                codcuentacobranza =
                ANY($1::text[])
              )
          `,
      [codigosActuales],
    );

    const dadasDeBaja = resultadoBajas.rowCount ?? 0;

    const nuevas = codigosActuales.filter(
      (codigo) => !existentesAntes.has(codigo),
    ).length;

    const actualizadas = codigosActuales.length - nuevas;

    await cliente.query(
      `
          INSERT INTO imports (
            nombre_archivo,
            fecha_import,
            cuentas_nuevas,
            cuentas_actualizadas,
            cuentas_dadas_de_baja
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
        `,
      [nombreArchivo, ahora, nuevas, actualizadas, dadasDeBaja],
    );

    return {
      totalFilasLeidas: filas.length,
      filasPermitidas: filasFiltradas.length,
      cuentasNuevas: nuevas,
      cuentasActualizadas: actualizadas,
      cuentasDadasDeBaja: dadasDeBaja,
      columnasAdaptadas: lectura.columnasAdaptadas,
      funcionariosReconocidos: seleccion.funcionariosReconocidos,
    };
  });
}
