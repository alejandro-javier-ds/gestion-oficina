import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { UUID, ErrorRemotoWhatsapp } from "../whatsapp-wire.mjs";
import { escribirAtomico, sincronizarDirectorio } from "./storage.mjs";

export function crearRegistroEnvios(carpeta, enviar) {
  const pendientes = new Map();
  return async function ejecutar(entrada, actor) {
    const { idEnvio, destino, mensaje } = entrada.payload;
    if (!UUID.test(idEnvio)) throw new ErrorRemotoWhatsapp("ENVIO_INVALIDO", "Identificador inválido.", 400);
    const hash = createHash("sha256").update(JSON.stringify([entrada.numero, destino, mensaje])).digest("hex");
    const archivo = path.join(carpeta, idEnvio + ".json");
    const ocupado = pendientes.get(idEnvio);
    if (ocupado) {
      if (ocupado.hash !== hash || ocupado.userId !== actor.userId) throw new ErrorRemotoWhatsapp("ENVIO_CONFLICTO", "Identificador de envío ocupado.", 409);
      return ocupado.promesa;
    }
    const promesa = (async () => {
      await fs.mkdir(carpeta, { recursive: true, mode: 0o700 });
      let existente;
      try { existente = JSON.parse(await fs.readFile(archivo, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw new ErrorRemotoWhatsapp("REGISTRO_ENVIO", "El registro de envío requiere revisión. No reintentar automáticamente."); }
      if (existente) {
        if (existente.hash !== hash || existente.userId !== actor.userId) throw new ErrorRemotoWhatsapp("ENVIO_CONFLICTO", "Identificador de envío ocupado.", 409);
        if (existente.estado === "final" && existente.resultado) return existente.resultado;
        return { ok: false, numeroSalida: entrada.numero, telefonoDestino: destino, estado: "ERROR", duracionMs: 0,
          detalle: "Resultado remoto incierto tras una interrupción. No reintentar automáticamente; verifica WhatsApp antes de otro envío." };
      }
      const intento = { v: 1, hash, userId: actor.userId, estado: "pendiente", fecha: new Date().toISOString() };
      const handle = await fs.open(archivo, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(intento)); await handle.sync(); }
      finally { await handle.close(); }
      await sincronizarDirectorio(carpeta);
      let resultado;
      try {
        const respuesta = await enviar(entrada.numero, destino, mensaje);
        const { mensaje: _mensaje, ...seguro } = respuesta;
        resultado = seguro;
      } catch {
        resultado = { ok: false, numeroSalida: entrada.numero, telefonoDestino: destino, estado: "ERROR", duracionMs: 0,
          detalle: "El servicio no confirmó el envío. No reintentar automáticamente; verifica WhatsApp antes de otro envío." };
      }
      await escribirAtomico(archivo, { ...intento, estado: "final", resultado });
      return resultado;
    })();
    pendientes.set(idEnvio, { hash, userId: actor.userId, promesa });
    try { return await promesa; } finally { pendientes.delete(idEnvio); }
  };
}
