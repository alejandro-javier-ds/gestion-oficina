"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";
import { destinosElegidosWhatsapp } from "@/lib/whatsapp/seguimiento";
import { obtenerPlantilla, tieneVariables } from "@/lib/whatsapp/plantillas";
import type { PropuestaId } from "@/components/whatsapp/CampanasWhatsapp";
import type { MetadataWhatsappSeleccion } from "./useWhatsappSeleccion";
import {
  SIN_CONFIRMACIONES_WHATSAPP,
  type ConfirmacionesWhatsapp,
} from "@/components/whatsapp/ControlSeguimientoWhatsapp";

type Destino = {
  idc: string;
  cliente: string;
  gestor: string | null;
  telefonoDestino: string;
  tipoTelefono: string;
  mensaje: string;
  estado: "PREPARADO";
  error: null;
  tenor: string | null;
};
type Props = {
  propuestaActual: string;
  rango: { desde: string; hasta: string; etiqueta: string };
  gestor: string;
  clientes: ClienteWhatsapp[];
  seleccionados: string[];
  cantidadSeleccionados: number;
  obtenerMetadata: (id: string) => MetadataWhatsappSeleccion | undefined;
  numeroSalida: string;
  telefonosManuales: Record<string, string[]>;
  telefonosSeleccionados: Record<string, string[]>;
  mensajeBase: string;
  mensajesIndividuales: Record<string, string>;
  generarMensajeCliente: (cliente: ClienteWhatsapp, base: string) => string;
  setClientesPreparados: (clientes: ClienteWhatsapp[]) => void;
  setMensajesIndividuales: (mensajes: Record<string, string>) => void;
  setMensajeBaseOriginal: (mensaje: string) => void;
  setClienteRevision: (cliente: ClienteWhatsapp | null) => void;
  setEstadoAbierto: (abierto: boolean) => void;
  setRevisionAbierta: (abierto: boolean) => void;
  setClienteVista: (cliente: ClienteWhatsapp | null) => void;
  onError?: (mensaje: string) => void;
  campanaSeguimientoId?: number | null;
  nombreCampanaGuardada?: string;
  resolverClientes?: () => Promise<ClienteWhatsapp[]>;
  plantillaCliente?: (cliente: ClienteWhatsapp) => string;
  validarPlantillaCliente?: (
    cliente: ClienteWhatsapp,
    plantilla: string,
    mensaje: string,
  ) => string | null;
  adaptarClientesGuardados?: (clientes: ClienteWhatsapp[]) => ClienteWhatsapp[];
  onGuardada?: (id: number) => void;
  onFinalizar?: () => void;
  puedeEnviar?: boolean;
};
export function useWhatsappCampana(props: Props) {
  const [campanaId, setCampanaId] = useState<number | null>(null);
  const [versionSeleccion, setVersionSeleccion] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviandoCampana, setEnviandoCampana] = useState(false);
  const [procesados, setProcesados] = useState(0);
  const [contadores, setContadores] = useState({
    preparados: 0,
    sinTelefono: 0,
    fallidos: 0,
    inciertos: 0,
  });
  const [borrador, setBorrador] = useState<ClienteWhatsapp[]>([]);
  const [errorCampana, setErrorCampana] = useState("");
  const [confirmaciones, setConfirmaciones] = useState<ConfirmacionesWhatsapp>(
    SIN_CONFIRMACIONES_WHATSAPP,
  );
  const ocupado = useRef(false);
  const {
    telefonosSeleccionados,
    telefonosManuales,
    mensajesIndividuales,
    obtenerMetadata,
    plantillaCliente,
    mensajeBase,
    validarPlantillaCliente,
  } = props;
  const seleccionActual = useMemo(() => {
    const destinos: Destino[] = [];
    const advertencias = {
      anteriores: false,
      fallidos: false,
      inciertos: false,
    };
    try {
      for (const cliente of borrador) {
        const telefonos = destinosElegidosWhatsapp(
          cliente,
          telefonosSeleccionados[cliente.id] ?? [],
          telefonosManuales[cliente.id] ?? [],
        );
        for (const t of telefonos) {
          const estado = cliente.seguimiento?.telefonos.find(
            (n) => n.numero === t.numero,
          );
          advertencias.anteriores ||= !!estado?.enviosAnteriores;
          advertencias.fallidos ||=
            estado?.estado === "FALLIDO" || !!estado?.requiereReintento;
          advertencias.inciertos ||= !!estado?.resultadosAnterioresInciertos;
          const propuesta = obtenerMetadata(cliente.id)?.campana;
          const plantilla =
            plantillaCliente?.(cliente) ??
            (propuesta
              ? obtenerPlantilla(propuesta as PropuestaId)
              : mensajeBase);
          const mensaje = mensajesIndividuales[cliente.id] ?? "";
          if (!mensaje.trim())
            throw new Error(
              "Completa el mensaje de cada cliente antes de confirmar.",
            );
          const errorPlantilla = validarPlantillaCliente?.(
            cliente,
            plantilla,
            mensaje,
          );
          if (errorPlantilla) throw new Error(errorPlantilla);
          if (tieneVariables(mensaje))
            throw new Error(
              "El mensaje contiene variables sin completar. Corrígelo antes de continuar.",
            );
          destinos.push({
            idc: cliente.idc,
            cliente: cliente.cliente,
            gestor: cliente.gestor,
            telefonoDestino: t.numero,
            tipoTelefono: t.tipoTelefono,
            mensaje,
            estado: "PREPARADO",
            error: null,
            tenor: obtenerMetadata(cliente.id)?.campana ?? null,
          });
        }
      }
      return { destinos, advertencias, error: "" };
    } catch (e) {
      return {
        destinos: [],
        advertencias,
        error:
          e instanceof Error
            ? e.message
            : "Revisa los teléfonos seleccionados.",
      };
    }
  }, [
    borrador,
    telefonosSeleccionados,
    telefonosManuales,
    mensajesIndividuales,
    obtenerMetadata,
    plantillaCliente,
    mensajeBase,
    validarPlantillaCliente,
  ]);
  const reiniciarEstadoCampana = useCallback(() => {
    setCampanaId(null);
    setVersionSeleccion(null);
    setPreparando(false);
    setProcesados(0);
    setContadores({ preparados: 0, sinTelefono: 0, fallidos: 0, inciertos: 0 });
    setBorrador([]);
    setErrorCampana("");
    setConfirmaciones(SIN_CONFIRMACIONES_WHATSAPP);
  }, []);
  useEffect(() => {
    if (!enviandoCampana || !campanaId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function actualizar() {
      try {
        const r = await fetch("/api/whatsapp/progreso?campanaId=" + campanaId, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw new Error("No se pudo consultar el progreso.");
        const data = await r.json();
        if (controller.signal.aborted) return;
        setProcesados(Number(data.procesados ?? 0));
        setContadores({
          preparados: Number(data.preparados ?? 0),
          sinTelefono: Number(data.sinTelefono ?? 0),
          fallidos: Number(data.fallidos ?? 0),
          inciertos: Number(data.inciertos ?? 0),
        });
        if (["ENVIADA", "ENVIADA_CON_ERRORES", "ERROR", "REQUIERE_REVISION"].includes(data.estado))
          return;
      } catch {
        if (controller.signal.aborted) return;
      }
      timer = setTimeout(() => void actualizar(), 1000);
    }
    void actualizar();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [campanaId, enviandoCampana]);
  const fallo = (e: unknown) => {
    const mensaje =
      e instanceof Error ? e.message : "No se pudo completar la operación.";
    setErrorCampana(mensaje);
    props.onError?.(mensaje);
  };
  async function prepararEnvio() {
    if (ocupado.current || !props.cantidadSeleccionados || !props.numeroSalida)
      return;
    ocupado.current = true;
    setPreparando(true);
    setErrorCampana("");
    setProcesados(0);
    props.setEstadoAbierto(true);
    try {
      if (props.campanaSeguimientoId) {
        const r = await fetch(
          "/api/whatsapp/seguimiento?campanaId=" + props.campanaSeguimientoId,
          { cache: "no-store" },
        );
        const data = await r.json();
        if (!r.ok)
          throw new Error(
            data.error ?? "No se pudo comprobar la selección guardada.",
          );
        setVersionSeleccion(data.versionSeleccion);
      }
      const recuperados = new Map<string, ClienteWhatsapp>();
      if (props.resolverClientes)
        for (const c of await props.resolverClientes())
          recuperados.set(c.id, c);
      else {
        const campanas = [
          ...new Set(
            props.seleccionados
              .map((id) => props.obtenerMetadata(id)?.campana)
              .filter(Boolean),
          ),
        ];
        for (const campana of campanas) {
          const params = new URLSearchParams({
            campana: campana!,
            vista: "todos",
            desde: props.rango.desde,
            hasta: props.rango.hasta,
          });
          if (props.gestor) params.set("gestor", props.gestor);
          if (props.campanaSeguimientoId)
            params.set("campanaId", String(props.campanaSeguimientoId));
          const r = await fetch("/api/whatsapp/clientes?" + params, {
            cache: "no-store",
          });
          const data = await r.json();
          if (!r.ok)
            throw new Error(
              data.error ?? "No se pudieron validar los clientes.",
            );
          for (const c of data.clientes as ClienteWhatsapp[])
            recuperados.set(c.id, c);
        }
      }
      for (const c of props.clientes)
        if (!recuperados.has(c.id)) recuperados.set(c.id, c);
      const elegidos = props.seleccionados
        .map((id) => recuperados.get(id))
        .filter((c): c is ClienteWhatsapp => !!c);
      if (elegidos.length !== props.seleccionados.length)
        throw new Error(
          "Algún cliente dejó de estar disponible. Actualiza la selección.",
        );
      const mensajes: Record<string, string> = {};
      let total = 0;
      for (const c of elegidos) {
        const telefonos = destinosElegidosWhatsapp(
          c,
          props.telefonosSeleccionados[c.id] ?? [],
          props.telefonosManuales[c.id] ?? [],
        );
        total += telefonos.length;
        const propuesta = props.obtenerMetadata(c.id)?.campana;
        const plantilla =
          props.plantillaCliente?.(c) ??
          (propuesta
            ? obtenerPlantilla(propuesta as PropuestaId)
            : props.mensajeBase);
        mensajes[c.id] =
          props.mensajesIndividuales[c.id] ??
          props.generarMensajeCliente(c, plantilla);
        const errorPlantilla = props.validarPlantillaCliente?.(
          c,
          plantilla,
          mensajes[c.id],
        );
        if (errorPlantilla) throw new Error(errorPlantilla);
        if (tieneVariables(mensajes[c.id]))
          throw new Error(
            "El mensaje contiene variables sin completar. Corrígelo antes de continuar.",
          );
      }
      if (!total)
        throw new Error(
          "Selecciona al menos un teléfono para preparar la campaña.",
        );
      setBorrador(elegidos);
      props.setClientesPreparados(elegidos);
      props.setMensajesIndividuales(mensajes);
      props.setMensajeBaseOriginal(props.mensajeBase);
      props.setClienteRevision(elegidos[0] ?? null);
      setContadores({ preparados: total, sinTelefono: 0, fallidos: 0, inciertos: 0 });
      setProcesados(elegidos.length);
      setConfirmaciones(SIN_CONFIRMACIONES_WHATSAPP);
      props.setRevisionAbierta(true);
    } catch (e) {
      fallo(e);
    } finally {
      ocupado.current = false;
      setPreparando(false);
      props.setEstadoAbierto(false);
    }
  }
  async function revisarCampanaGuardada() {
    const id = props.campanaSeguimientoId;
    if (!id || ocupado.current) return;
    ocupado.current = true;
    setPreparando(true);
    setErrorCampana("");
    try {
      const r = await fetch("/api/whatsapp/seguimiento?campanaId=" + id, {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error ?? "No se pudo recuperar la selección.");
      if (!data.destinatarios.length)
        throw new Error(
          "Esta campaña no tiene una selección preparada. Elige sus teléfonos pendientes.",
        );
      setVersionSeleccion(data.versionSeleccion);
      const clientes =
        props.adaptarClientesGuardados?.(data.clientes) ??
        (data.clientes as ClienteWhatsapp[]);
      const mensajes: Record<string, string> = {};
      props.setClientesPreparados(clientes);
      setBorrador(clientes);
      for (const c of clientes) {
        const filas = data.destinatarios.filter(
          (d: { idc: string }) => d.idc === c.idc,
        );
        mensajes[c.id] = filas[0]?.mensaje ?? "";
      }
      props.setMensajesIndividuales(mensajes);
      props.setClienteRevision(clientes[0] ?? null);
      setConfirmaciones(SIN_CONFIRMACIONES_WHATSAPP);
      props.setRevisionAbierta(true);
      return data as {
        clientes: ClienteWhatsapp[];
        destinatarios: {
          idc: string;
          telefono_destino: string;
          tipo_telefono: string;
        }[];
      };
    } catch (e) {
      fallo(e);
    } finally {
      ocupado.current = false;
      setPreparando(false);
    }
  }
  async function confirmarCampaña() {
    if (ocupado.current) return;
    if (seleccionActual.error) {
      fallo(new Error(seleccionActual.error));
      return;
    }
    if (!seleccionActual.destinos.length) {
      fallo(new Error("Selecciona al menos un teléfono antes de confirmar."));
      return;
    }
    const a = seleccionActual.advertencias;
    if (
      (a.anteriores && !confirmaciones.confirmarSeguimientos) ||
      (a.fallidos && !confirmaciones.confirmarReintentos) ||
      (a.inciertos && !confirmaciones.confirmarResultadosRevisados)
    ) {
      fallo(
        new Error(
          "Confirma las advertencias de seguimiento antes de continuar.",
        ),
      );
      return;
    }
    ocupado.current = true;
    setEnviandoCampana(true);
    setErrorCampana("");
    try {
      const guardada = await fetch("/api/whatsapp/historial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campanaId: props.campanaSeguimientoId ?? campanaId,
          seleccionExplicita: true,
          versionSeleccion,
          campana: props.nombreCampanaGuardada ?? props.propuestaActual,
          gestor: props.gestor || null,
          desde: props.rango.desde,
          hasta: props.rango.hasta,
          numeroSalida: props.numeroSalida,
          destinatarios: seleccionActual.destinos,
          ...confirmaciones,
        }),
      });
      const datos = await guardada.json();
      if (!guardada.ok)
        throw new Error(datos.error ?? "No se pudo guardar la selección.");
      const id = Number(datos.id);
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !/^[a-f0-9]{64}$/.test(datos.versionSeleccion ?? "")
      )
        throw new Error(
          "No se pudo confirmar el ID de campaña. Revisa el historial antes de volver a guardar.",
        );
      setCampanaId(id);
      setVersionSeleccion(datos.versionSeleccion);
      props.onGuardada?.(id);
      if (props.puedeEnviar !== false) {
        props.setEstadoAbierto(true);
        const r = await fetch("/api/whatsapp/enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campanaId: id,
            seleccionExplicita: true,
            versionSeleccion: datos.versionSeleccion,
            ...confirmaciones,
          }),
        });
        const data = await r.json();
        setProcesados(Number(data.procesados ?? 0));
        setContadores({
          preparados: Number(data.preparados ?? 0),
          sinTelefono: Number(data.sinTelefono ?? 0),
          fallidos: Number(data.fallidos ?? 0),
          inciertos: Number(data.inciertos ?? 0),
        });
        if (!r.ok)
          throw new Error(data.error ?? "No se pudo enviar la campaña.");
        if (data.estado === "REQUIERE_REVISION" || Number(data.inciertos) > 0)
          fallo(
            new Error(
              "La campaña terminó con resultados inciertos. Verifica cada teléfono en el historial antes de volver a preparar un envío.",
            ),
          );
      }
      props.setRevisionAbierta(false);
      props.setClienteRevision(null);
      props.setClienteVista(null);
      props.onFinalizar?.();
    } catch (e) {
      fallo(e);
    } finally {
      ocupado.current = false;
      setEnviandoCampana(false);
      props.setEstadoAbierto(false);
    }
  }
  return {
    campanaId: props.campanaSeguimientoId ?? campanaId,
    enviandoCampana,
    preparando,
    procesados,
    preparados:
      !enviandoCampana && borrador.length
        ? seleccionActual.destinos.length
        : contadores.preparados,
    sinTelefono: contadores.sinTelefono,
    fallidos: contadores.fallidos,
    inciertos: contadores.inciertos,
    prepararEnvio,
    confirmarCampaña,
    revisarCampanaGuardada,
    reiniciarEstadoCampana,
    errorCampana,
    confirmaciones,
    setConfirmaciones,
    advertencias: seleccionActual.advertencias,
    errorSeleccion: seleccionActual.error,
  };
}
