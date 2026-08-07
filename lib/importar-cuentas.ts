// lib/importar-cuentas.ts
// Lógica compartida para importar un portafolio de cuentas.
// Además de actualizar cuentas.direccion

import * as XLSX from "xlsx";
import db from "./db";
import { FUNCIONARIOS_PERMITIDOS, DESCRIPCION_ROUTER } from "./mapeo-columnas";

export type ResumenImportacion = {
  totalFilasLeidas: number;
  filasPermitidas: number;
  cuentasNuevas: number;
  cuentasActualizadas: number;
  cuentasDadasDeBaja: number;
};

function limpiarTexto(texto: any): string {
  if (typeof texto !== "string") return "";
  return texto.replace(/[\s\u00A0]+/g, " ").trim();
}

function leerNroJuicio(fila: Record<string, any>): string | null {
  return fila["NRO_JUICIO"] ?? fila["NUMERO JUICIO"] ?? null;
}

function leerFecha(valor: any): string | null {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }
  return String(valor);
}

export function importarPortafolioDesdeBuffer(
  buffer: Buffer,
  nombreArchivo: string,
): ResumenImportacion {
  const ahora = new Date().toISOString();
  const fechaHoy = ahora.slice(0, 10);

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hoja = workbook.Sheets["Cuentas"];

  if (!hoja) {
    throw new Error('El Excel no tiene una hoja llamada "Cuentas".');
  }

  const filas: Record<string, any>[] = XLSX.utils.sheet_to_json(hoja);

  const filasFiltradas = filas.filter((fila) =>
    FUNCIONARIOS_PERMITIDOS.includes(limpiarTexto(fila["FUNCIONARIO"])),
  );

  const buscarRouterActual = db.prepare(
    "SELECT idc, router FROM cuentas WHERE codcuentacobranza = ?",
  );

  const insertarHistorialRouter = db.prepare(`
    INSERT INTO historial_router (idc, codcuentacobranza, fecha_registro, seguimiento, router, descripcion)
    VALUES (@idc, @codcuentacobranza, @fecha_registro, @seguimiento, @router, @descripcion)
  `);

  const upsert = db.prepare(`
    INSERT INTO cuentas (
      codcuentacobranza, idc, cliente, expediente, funcionario, gestor,
      mtodeuda_sol, mtodeudavencida_sol, codmoneda, deudatotal_monedaorigen,
      deudavencida_monedaorigen, dtp, estado_cartera, etapa_procesal,
      diasmora, rango_mora, prioridad, segmentacion, descproducto,
      direccion, distrito, provincia, departamento, router, nivel_riesgo,
      tipo_juicio, nro_juicio, fec_demanda, supervisor_procesal,
      analista_procesal, fec_entrega_legajo_a_estudio,
      activo, fecha_ultima_actualizacion
    ) VALUES (
      @codcuentacobranza, @idc, @cliente, @expediente, @funcionario, @gestor,
      @mtodeuda_sol, @mtodeudavencida_sol, @codmoneda, @deudatotal_monedaorigen,
      @deudavencida_monedaorigen, @dtp, @estado_cartera, @etapa_procesal,
      @diasmora, @rango_mora, @prioridad, @segmentacion, @descproducto,
      @direccion, @distrito, @provincia, @departamento, @router, @nivel_riesgo,
      @tipo_juicio, @nro_juicio, @fec_demanda, @supervisor_procesal,
      @analista_procesal, @fec_entrega_legajo_a_estudio,
      1, @fecha_ultima_actualizacion
    )
    ON CONFLICT(codcuentacobranza) DO UPDATE SET
      idc = excluded.idc,
      cliente = excluded.cliente,
      expediente = excluded.expediente,
      funcionario = excluded.funcionario,
      gestor = excluded.gestor,
      mtodeuda_sol = excluded.mtodeuda_sol,
      mtodeudavencida_sol = excluded.mtodeudavencida_sol,
      codmoneda = excluded.codmoneda,
      deudatotal_monedaorigen = excluded.deudatotal_monedaorigen,
      deudavencida_monedaorigen = excluded.deudavencida_monedaorigen,
      dtp = excluded.dtp,
      estado_cartera = excluded.estado_cartera,
      etapa_procesal = excluded.etapa_procesal,
      diasmora = excluded.diasmora,
      rango_mora = excluded.rango_mora,
      prioridad = excluded.prioridad,
      segmentacion = excluded.segmentacion,
      descproducto = excluded.descproducto,
      direccion = excluded.direccion,
      distrito = excluded.distrito,
      provincia = excluded.provincia,
      departamento = excluded.departamento,
      router = excluded.router,
      nivel_riesgo = excluded.nivel_riesgo,
      tipo_juicio = excluded.tipo_juicio,
      nro_juicio = excluded.nro_juicio,
      fec_demanda = excluded.fec_demanda,
      supervisor_procesal = excluded.supervisor_procesal,
      analista_procesal = excluded.analista_procesal,
      fec_entrega_legajo_a_estudio = excluded.fec_entrega_legajo_a_estudio,
      activo = 1,
      fecha_ultima_actualizacion = excluded.fecha_ultima_actualizacion;
  `);

  const buscarDireccionPortafolio = db.prepare(
    `SELECT id FROM direcciones WHERE idc = ? AND fuente = 'portafolio'`,
  );
  const actualizarDireccionPortafolio = db.prepare(`
    UPDATE direcciones SET direccion = @direccion, distrito = @distrito, provincia = @provincia,
      departamento = @departamento, fecha_modificacion = @fecha_modificacion
    WHERE id = @id
  `);
  const crearDireccionPortafolio = db.prepare(`
    INSERT INTO direcciones (idc, direccion, distrito, provincia, departamento, tipo, fuente, fecha_modificacion, activo)
    VALUES (@idc, @direccion, @distrito, @provincia, @departamento, 'Domicilio', 'portafolio', @fecha_modificacion, 1)
  `);

  const existentesAntes = new Set(
    db
      .prepare("SELECT codcuentacobranza FROM cuentas")
      .all()
      .map((r: any) => r.codcuentacobranza),
  );

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

  const transaccion = db.transaction((filas: Record<string, any>[]) => {
    for (const fila of filas) {
      const codigo = String(fila["CODCUENTACOBRANZA"]);
      const idc = String(fila["IDC"]);
      const routerNuevo = fila["ROUTER"] ?? null;
      codigosEnEsteImport.add(codigo);

      const cuentaExistente = buscarRouterActual.get(codigo) as
        | { idc: string; router: string | null }
        | undefined;

      const routerAnterior = cuentaExistente?.router ?? null;

      if (routerNuevo && routerNuevo !== routerAnterior) {
        if (routerAnterior) {
          insertarHistorialRouter.run({
            idc,
            codcuentacobranza: codigo,
            fecha_registro: fechaHoy,
            seguimiento: `Fin Router Router ${routerAnterior}`,
            router: routerAnterior,
            descripcion: DESCRIPCION_ROUTER[routerAnterior] ?? null,
          });
        }
        insertarHistorialRouter.run({
          idc,
          codcuentacobranza: codigo,
          fecha_registro: fechaHoy,
          seguimiento: `Inicio Router Router ${routerNuevo}`,
          router: routerNuevo,
          descripcion: DESCRIPCION_ROUTER[routerNuevo] ?? null,
        });
      }

      upsert.run({
        codcuentacobranza: codigo,
        idc,
        cliente: limpiarTexto(fila["CLIENTE"]) || null,
        expediente: fila["EXPEDIENTE"] ?? null,
        funcionario: limpiarTexto(fila["FUNCIONARIO"]) || null,
        gestor: limpiarTexto(fila["GESTOR"]) || null,
        mtodeuda_sol: fila["MTODEUDA_SOL"] ?? null,
        mtodeudavencida_sol: fila["MTODEUDAVENCIDA_SOL"] ?? null,
        codmoneda: limpiarTexto(fila["CODMONEDA"]) || null,
        deudatotal_monedaorigen: fila["DEUDATOTAL_MONEDAORIGEN"] ?? null,
        deudavencida_monedaorigen: fila["DEUDAVENCIDA_MONEDAORIGEN"] ?? null,
        dtp: fila["DTP"] ?? null,
        estado_cartera: fila["ESTADO_CARTERA"] ?? null,
        etapa_procesal: fila["ETAPA_PROCESAL"] ?? null,
        diasmora: fila["DIASMORA"] ?? null,
        rango_mora: fila["RANGO_MORA"] ?? null,
        prioridad: fila["PRIORIDAD"] ?? null,
        segmentacion: fila["SEGMENTACION"] ?? null,
        descproducto: fila["DESCPRODUCTO"] ?? null,
        direccion: fila["DIRECCION"] ?? null,
        distrito: fila["DISTRITO"] ?? null,
        provincia: fila["PROVINCIA"] ?? null,
        departamento: fila["DEPARTAMENTO"] ?? null,
        router: routerNuevo,
        nivel_riesgo: fila["CLASIF_RIESGOBCP"] ?? null,
        tipo_juicio: fila["TIPO_JUICIO"] ?? null,
        nro_juicio: leerNroJuicio(fila),
        fec_demanda: leerFecha(fila["FEC_DEMANDA"]),
        supervisor_procesal: limpiarTexto(fila["SUPERVISOR PROCESAL"]) || null,
        analista_procesal: limpiarTexto(fila["ANALISTA PROCESAL"]) || null,
        fec_entrega_legajo_a_estudio: leerFecha(
          fila["FEC_ENTREGA_LEGAJO_A_ESTUDIO"],
        ),
        fecha_ultima_actualizacion: ahora,
      });

      if (fila["DIRECCION"]) {
        direccionesPorIdc.set(idc, {
          direccion: String(fila["DIRECCION"]),
          distrito: fila["DISTRITO"] ?? null,
          provincia: fila["PROVINCIA"] ?? null,
          departamento: fila["DEPARTAMENTO"] ?? null,
        });
      }
    }

    for (const [idc, dir] of direccionesPorIdc) {
      const existente = buscarDireccionPortafolio.get(idc) as
        | { id: number }
        | undefined;
      if (existente) {
        actualizarDireccionPortafolio.run({
          id: existente.id,
          ...dir,
          fecha_modificacion: ahora,
        });
      } else {
        crearDireccionPortafolio.run({
          idc,
          ...dir,
          fecha_modificacion: ahora,
        });
      }
    }
  });

  transaccion(filasFiltradas);

  const marcarInactivas = db.prepare(`
    UPDATE cuentas SET activo = 0
    WHERE activo = 1 AND codcuentacobranza = ?
  `);

  let dadasDeBaja = 0;
  for (const codigo of existentesAntes) {
    if (!codigosEnEsteImport.has(codigo)) {
      marcarInactivas.run(codigo);
      dadasDeBaja++;
    }
  }

  const nuevas = [...codigosEnEsteImport].filter(
    (c) => !existentesAntes.has(c),
  ).length;
  const actualizadas = codigosEnEsteImport.size - nuevas;

  db.prepare(
    `
    INSERT INTO imports (nombre_archivo, fecha_import, cuentas_nuevas, cuentas_actualizadas, cuentas_dadas_de_baja)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(nombreArchivo, ahora, nuevas, actualizadas, dadasDeBaja);

  return {
    totalFilasLeidas: filas.length,
    filasPermitidas: filasFiltradas.length,
    cuentasNuevas: nuevas,
    cuentasActualizadas: actualizadas,
    cuentasDadasDeBaja: dadasDeBaja,
  };
}
