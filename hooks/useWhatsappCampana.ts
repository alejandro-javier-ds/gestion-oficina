// hooks/useWhatsappCampana.ts
// Orquesta preparación, guardado, progreso y envío REAL de campañas.
// Los endpoints y payloads existentes se mantienen.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";
import type { PropuestaId } from "@/components/whatsapp/CampanasWhatsapp";
import { obtenerPlantilla } from "@/lib/whatsapp/plantillas";
import type { MetadataWhatsappSeleccion } from "./useWhatsappSeleccion";

type RangoWhatsapp = {
  desde: string;
  hasta: string;
  etiqueta: string;
};

type MensajesIndividuales = Record<string, string>;

type RespuestaClientesWhatsapp = {
  clientes: ClienteWhatsapp[];
  total: number;
};

type DestinatarioWhatsapp = {
  idc: string;
  cliente: string;
  gestor?: string | null;
  telefonoDestino: string;
  tipoTelefono: string;
  estado: string;
  error?: string | null;
  mensaje: string;
  tenor?: string | null;
};

type Resultado = {
  campanaId: number | null;
  enviandoCampana: boolean;
  preparando: boolean;
  procesados: number;
  preparados: number;
  sinTelefono: number;
  fallidos: number;
  prepararEnvio: () => Promise<void>;
  confirmarCampaña: () => Promise<void>;
  reiniciarEstadoCampana: () => void;
};

export function useWhatsappCampana({
  propuestaActual,
  rango,
  gestor,
  clientes,
  seleccionados,
  cantidadSeleccionados,
  obtenerMetadata,
  numeroSalida,
  usarTelefonoManual,
  telefonosManuales,
  telefonosSeleccionados,
  mensajeBase,
  mensajesIndividuales,
  generarMensajeCliente,
  setClientesPreparados,
  setMensajesIndividuales,
  setMensajeBaseOriginal,
  setClienteRevision,
  setEstadoAbierto,
  setRevisionAbierta,
  setClienteVista,
  onError,
}: {
  propuestaActual: string;
  rango: RangoWhatsapp;
  gestor: string;
  clientes: ClienteWhatsapp[];
  seleccionados: string[];
  cantidadSeleccionados: number;
  obtenerMetadata: (id: string) => MetadataWhatsappSeleccion | undefined;
  numeroSalida: string;
  usarTelefonoManual: Record<string, boolean>;
  telefonosManuales: Record<string, string>;
  telefonosSeleccionados: Record<string, string>;
  mensajeBase: string;
  mensajesIndividuales: MensajesIndividuales;
  generarMensajeCliente: (cliente: ClienteWhatsapp, base: string) => string;
  setClientesPreparados: (clientes: ClienteWhatsapp[]) => void;
  setMensajesIndividuales: (mensajes: MensajesIndividuales) => void;
  setMensajeBaseOriginal: (mensaje: string) => void;
  setClienteRevision: (cliente: ClienteWhatsapp | null) => void;
  setEstadoAbierto: (abierto: boolean) => void;
  setRevisionAbierta: (abierto: boolean) => void;
  setClienteVista: (cliente: ClienteWhatsapp | null) => void;
  onError?: (mensaje: string) => void;
}): Resultado {
  const [campanaId, setCampanaId] = useState<number | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviandoCampana, setEnviandoCampana] = useState(false);
  const [procesados, setProcesados] = useState(0);
  const [preparados, setPreparados] = useState(0);
  const [sinTelefono, setSinTelefono] = useState(0);
  const [fallidos, setFallidos] = useState(0);

  const reiniciarEstadoCampana = useCallback(() => {
    setCampanaId(null);
    setPreparando(false);
    setEnviandoCampana(false);
    setProcesados(0);
    setPreparados(0);
    setSinTelefono(0);
    setFallidos(0);
  }, []);

  useEffect(() => {
    if (!enviandoCampana || !campanaId) return;

    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const actualizarProgreso = async () => {
      if (cancelado) return;

      try {
        const response = await fetch(
          `/api/whatsapp/progreso?campanaId=${campanaId}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("No se pudo consultar el progreso.");
        }

        const data = (await response.json()) as {
          total?: number;
          preparados?: number;
          enviados?: number;
          errores?: number;
          sinTelefono?: number;
          procesados?: number;
          estado?: string;
        };

        if (cancelado) return;

        const totalBd = Number(data.total ?? cantidadSeleccionados);
        const preparadosBd = Number(data.preparados ?? 0);
        const enviadosBd = Number(data.enviados ?? 0);
        const erroresBd = Number(data.errores ?? 0);
        const sinTelefonoBd = Number(data.sinTelefono ?? 0);
        const procesadosBd = Number(
          data.procesados ?? enviadosBd + erroresBd + sinTelefonoBd,
        );

        setProcesados(Math.min(procesadosBd, totalBd));
        setPreparados(Math.max(preparadosBd, 0));
        setSinTelefono(Math.max(sinTelefonoBd, 0));
        setFallidos(Math.max(erroresBd, 0));

        if (
          data.estado === "ENVIADA" ||
          data.estado === "ENVIADA_CON_ERRORES" ||
          data.estado === "ERROR"
        ) {
          return;
        }
      } catch (error) {
        console.warn("[WhatsApp] Error consultando progreso:", error);
      }

      if (!cancelado) {
        timer = setTimeout(actualizarProgreso, 700);
      }
    };

    void actualizarProgreso();

    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, [campanaId, enviandoCampana, cantidadSeleccionados]);

  const prepararEnvio = useCallback(async () => {
    if (cantidadSeleccionados === 0 || !numeroSalida) return;

    setProcesados(0);
    setPreparados(0);
    setSinTelefono(0);
    setFallidos(0);
    setCampanaId(null);
    setEstadoAbierto(true);
    setPreparando(true);

    try {
      const campanasSeleccionadas = Array.from(
        new Set(
          seleccionados
            .map((id) => obtenerMetadata(id)?.campana)
            .filter((valor): valor is string => Boolean(valor)),
        ),
      );

      const clientesPorId = new Map<string, ClienteWhatsapp>();

      for (const campanaCliente of campanasSeleccionadas) {
        const params = new URLSearchParams({
          campana: campanaCliente,
          vista: "todos",
          desde: rango.desde,
          hasta: rango.hasta,
        });

        if (gestor) params.set("gestor", gestor);

        const response = await fetch(
          `/api/whatsapp/clientes?${params.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          throw new Error(
            data?.error ??
            `No se pudieron recuperar los destinatarios de la campaña ${campanaCliente}.`,
          );
        }

        const data = (await response.json()) as RespuestaClientesWhatsapp;

        for (const cliente of data.clientes) {
          if (seleccionados.includes(cliente.id)) {
            clientesPorId.set(cliente.id, cliente);
          }
        }
      }

      for (const cliente of clientes) {
        if (seleccionados.includes(cliente.id)) {
          clientesPorId.set(cliente.id, cliente);
        }
      }

      const clientesSeleccionados = Array.from(clientesPorId.values());

      let procesadosActuales = 0;
      let preparadosActuales = 0;
      let sinTelefonoActuales = 0;
      let fallidosActuales = 0;

      const destinatarios: DestinatarioWhatsapp[] = [];
      const mensajesGenerados: MensajesIndividuales = {};

      for (const cliente of clientesSeleccionados) {
        let destino = "";
        let tipoTelefono = "";
        let estado = "PREPARADO";
        let errorDestinatario: string | null = null;

        try {
          const usaManual = usarTelefonoManual[cliente.id] ?? false;
          const telefonoManual = telefonosManuales[cliente.id] ?? "";
          const telefonoElegido = telefonosSeleccionados[cliente.id];

          if (usaManual) {
            destino = telefonoManual.replace(/\D/g, "").replace(/^51/, "");
            tipoTelefono = "manual";
          } else {
            const registrado = cliente.telefonos.find(
              (telefono) => String(telefono.id_phone) === telefonoElegido,
            );

            const celular =
              registrado ??
              cliente.telefonos.find(
                (telefono) =>
                  telefono.activo === 1 &&
                  telefono.tipo_telefono.toLowerCase() === "celular",
              );

            destino =
              celular?.phone?.replace(/\D/g, "").replace(/^51/, "") ?? "";
            tipoTelefono = celular?.tipo_telefono ?? "";
          }

          if (!/^9\d{8}$/.test(destino)) {
            estado = "SIN_TELEFONO";
            errorDestinatario = "No tiene un celular peruano válido.";
            sinTelefonoActuales++;
          } else {
            preparadosActuales++;
          }
        } catch {
          estado = "ERROR";
          errorDestinatario = "Error al validar el destinatario.";
          fallidosActuales++;
        }

        const metadata = obtenerMetadata(cliente.id);
        const campanaCliente = metadata?.campana;
        const plantillaCliente = campanaCliente
          ? obtenerPlantilla(campanaCliente as PropuestaId)
          : mensajeBase;

        const mensajeFinal =
          mensajesIndividuales[cliente.id] ??
          generarMensajeCliente(cliente, plantillaCliente);

        mensajesGenerados[cliente.id] = mensajeFinal;

        destinatarios.push({
          idc: cliente.idc,
          cliente: cliente.cliente,
          gestor: cliente.gestor,
          telefonoDestino: destino,
          tipoTelefono,
          estado,
          error: errorDestinatario,
          mensaje: mensajeFinal,
          tenor: campanaCliente ?? null,
        });

        procesadosActuales++;
        setProcesados(procesadosActuales);
        setPreparados(preparadosActuales);
        setSinTelefono(sinTelefonoActuales);
        setFallidos(fallidosActuales);

        await new Promise((resolve) => setTimeout(resolve, 35));
      }

      setClientesPreparados(clientesSeleccionados);
      setMensajesIndividuales(mensajesGenerados);
      setMensajeBaseOriginal(mensajeBase);
      setClienteRevision(clientesSeleccionados[0] ?? null);

      const responseHistorial = await fetch("/api/whatsapp/historial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campana: propuestaActual,
          gestor: gestor || null,
          desde: rango.desde,
          hasta: rango.hasta,
          numeroSalida,
          totalSeleccionados: cantidadSeleccionados,
          totalPreparados: preparadosActuales,
          totalSinTelefono: sinTelefonoActuales,
          totalFallidos: fallidosActuales,
          destinatarios,
        }),
      });

      if (!responseHistorial.ok) {
        throw new Error(
          "La campaña fue preparada pero no se pudo guardar el historial.",
        );
      }

      const dataHistorial = (await responseHistorial.json()) as {
        ok: boolean;
        id: number;
        estado: string;
      };

      console.log("[WhatsApp] Campaña creada:", dataHistorial);

      if (!dataHistorial.id) {
        throw new Error(
          "La campaña fue guardada, pero el servidor no devolvió un ID válido.",
        );
      }

      setCampanaId(dataHistorial.id);
      setEstadoAbierto(false);
      setRevisionAbierta(true);
    } catch (errorPreparando) {
      console.error("[WhatsApp] Error preparando campaña:", errorPreparando);
      setFallidos((actual) => actual + 1);
      onError?.(
        errorPreparando instanceof Error
          ? errorPreparando.message
          : "Ocurrió un error preparando la campaña.",
      );
    } finally {
      setPreparando(false);
    }
  }, [
    cantidadSeleccionados,
    numeroSalida,
    seleccionados,
    obtenerMetadata,
    rango.desde,
    rango.hasta,
    gestor,
    clientes,
    usarTelefonoManual,
    telefonosManuales,
    telefonosSeleccionados,
    mensajeBase,
    mensajesIndividuales,
    generarMensajeCliente,
    propuestaActual,
    setClientesPreparados,
    setMensajesIndividuales,
    setMensajeBaseOriginal,
    setClienteRevision,
    setEstadoAbierto,
    setRevisionAbierta,
    onError,
  ]);

  const confirmarCampaña = useCallback(async () => {
    console.log("[WhatsApp] Confirmar campaña:", {
      campanaId,
      enviandoCampana,
      numeroSalida,
      cantidadSeleccionados,
      preparados,
    });

    if (enviandoCampana || !campanaId) return;

    setEnviandoCampana(true);
    setEstadoAbierto(true);

    try {
      console.log("[WhatsApp] Ejecutando POST /api/whatsapp/enviar", {
        campanaId,
      });

      const response = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campanaId }),
      });

      console.log("[WhatsApp] HTTP:", response.status);

      const data = (await response.json()) as {
        ok?: boolean;
        campanaId?: number;
        estado?: string;
        total?: number;
        enviados?: number;
        fallidos?: number;
        resultados?: Array<{
          id: number;
          idc: string;
          cliente: string | null;
          telefonoDestino: string | null;
          estado: "ENVIADO" | "ERROR";
          detalle: string;
          duracionMs: number;
        }>;
        error?: string;
      };

      console.log("[WhatsApp] Respuesta:", data);

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo enviar la campaña.");
      }

      setRevisionAbierta(false);
      setClienteRevision(null);
      setClienteVista(null);
      setEstadoAbierto(false);
    } catch (errorEnvio) {
      console.error("[WhatsApp] Error enviando campaña:", errorEnvio);
      setFallidos((actual) => actual + 1);
      onError?.(
        errorEnvio instanceof Error
          ? errorEnvio.message
          : "Ocurrió un error enviando la campaña.",
      );
    } finally {
      setEnviandoCampana(false);
    }
  }, [
    campanaId,
    enviandoCampana,
    numeroSalida,
    cantidadSeleccionados,
    preparados,
    setEstadoAbierto,
    setRevisionAbierta,
    setClienteRevision,
    setClienteVista,
    onError,
  ]);

  return {
    campanaId,
    enviandoCampana,
    preparando,
    procesados,
    preparados,
    sinTelefono,
    fallidos,
    prepararEnvio,
    confirmarCampaña,
    reiniciarEstadoCampana,
  };
}
