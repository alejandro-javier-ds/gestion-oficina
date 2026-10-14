import { randomUUID } from "node:crypto";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function validarCampanasGuardadas(guardadas) {
  if (!guardadas || typeof guardadas !== "object" || Array.isArray(guardadas) || Object.keys(guardadas).length > 1000) throw new Error("Registro de campañas activas inválido.");
  for (const [id, dato] of Object.entries(guardadas)) {
    if (!UUID.test(id) || !Number.isSafeInteger(dato?.campanaId) || dato.campanaId < 1 || !Number.isSafeInteger(dato?.userId) || dato.userId < 1) throw new Error("Registro de campañas activas inválido.");
  }
  return guardadas;
}

export async function recuperarReservasHuerfanas({ guardadas, archivar, guardar }) {
  const huerfanas = validarCampanasGuardadas(guardadas);
  const cantidad = Object.keys(huerfanas).length;
  if (cantidad === 0) return { guardadas: huerfanas, recuperadas: 0 };
  await archivar(huerfanas);
  await guardar({});
  return { guardadas: {}, recuperadas: cantidad };
}

export function crearCoordinadorMantenimiento({ guardadas = {}, guardar, guardarMantenimiento = async () => {}, mantenimientoInicial = false, exigirReservas = false, esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const activas = new Map(Object.entries(validarCampanasGuardadas(guardadas)));
  let mantenimiento = mantenimientoInicial;
  let integridad = true;
  let escrituras = Promise.resolve();

  function persistir() {
    const siguiente = escrituras.catch(() => {}).then(() => guardar(Object.fromEntries(activas)));
    escrituras = siguiente;
    return siguiente;
  }

  async function actualizar(mutacion, reversa) {
    mutacion();
    try {
      await persistir();
    } catch (error) {
      reversa();
      integridad = false;
      throw error;
    }
  }

  function tieneLease(leaseId, userId) {
    const lease = activas.get(leaseId);
    return Boolean(lease && lease.userId === userId);
  }

  return {
    async iniciarCampana(campanaId, userId) {
      if (mantenimiento || !integridad) throw new Error("El mantenimiento no admite campañas nuevas.");
      const leaseId = randomUUID();
      const dato = { campanaId, userId };
      await actualizar(() => activas.set(leaseId, dato), () => activas.delete(leaseId));
      return leaseId;
    },
    async finalizarCampana(leaseId, campanaId, userId) {
      const dato = activas.get(leaseId);
      if (!dato) return { ok: true, liberada: false };
      if (dato.campanaId !== campanaId || dato.userId !== userId) throw new Error("La reserva de campaña no pertenece a esta sesión.");
      await actualizar(() => activas.delete(leaseId), () => activas.set(leaseId, dato));
      return { ok: true, liberada: true };
    },
    validarEnvio(leaseId, userId) {
      return !exigirReservas && !mantenimiento || tieneLease(leaseId, userId);
    },
    admite(entrada, actor) {
      if (entrada.op === "campana" && entrada.payload.accion === "finalizar") return true;
      const leaseValido = tieneLease(actor.campanaLeaseId, actor.userId);
      if (mantenimiento) return leaseValido && entrada.op !== "campana";
      if (entrada.op === "enviar") return !exigirReservas || leaseValido && actor.campanaLeaseId === entrada.payload.leaseId;
      return !mantenimiento;
    },
    async preparar({ trabajosPendientes, cerrarVisores, timeoutMs = 7_200_000, intervaloMs = 250 }) {
      if (!exigirReservas) return { ok: false, motivo: "coordinacion_no_disponible" };
      if (mantenimiento || !integridad) return { ok: false, motivo: "coordinacion_no_disponible" };
      try {
        await guardarMantenimiento(true);
        mantenimiento = true;
      } catch {
        integridad = false;
        return { ok: false, motivo: "coordinacion_no_disponible" };
      }
      const limite = Date.now() + timeoutMs;
      while (activas.size > 0 || trabajosPendientes() > 0) {
        if (Date.now() >= limite) {
          try {
            await guardarMantenimiento(false);
            mantenimiento = false;
          } catch {
            integridad = false;
            return { ok: false, motivo: "coordinacion_no_disponible" };
          }
          return { ok: false, motivo: "operaciones_no_finalizaron", campanasActivas: activas.size, operacionesActivas: trabajosPendientes() };
        }
        await esperar(intervaloMs);
      }
      cerrarVisores();
      return { ok: true, campanasActivas: 0, operacionesActivas: 0 };
    },
    async abortar({ trabajosPendientes = () => Number(0) } = {}) {
      if (!mantenimiento) return { ok: true, mantenimiento: false };
      if (activas.size > 0 || trabajosPendientes() > 0) return { ok: false, motivo: "operaciones_activas", campanasActivas: activas.size, operacionesActivas: trabajosPendientes() };
      try {
        await guardarMantenimiento(false);
      } catch {
        integridad = false;
        return { ok: false, motivo: "coordinacion_no_disponible" };
      }
      mantenimiento = false;
      return { ok: true, mantenimiento: false };
    },
    estado() {
      return { mantenimiento, integridad, campanasActivas: activas.size };
    },
  };
}
