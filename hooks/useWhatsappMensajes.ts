// hooks/useWhatsappMensajes.ts
"use client";

import { useCallback, useState } from "react";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";
import type { PropuestaId } from "@/components/whatsapp/CampanasWhatsapp";
import {
  obtenerPlantilla,
  reemplazarVariablesMensaje,
} from "@/lib/whatsapp/plantillas";
import type { MetadataWhatsappSeleccion } from "./useWhatsappSeleccion";

type MensajesIndividuales = Record<string, string>;

type Resultado = {
  mensajeBase: string;
  mensajeBaseOriginal: string;
  clientesPreparados: ClienteWhatsapp[];
  mensajesIndividuales: MensajesIndividuales;
  generarMensajeCliente: (cliente: ClienteWhatsapp, base: string) => string;
  aplicarMensajeATodos: () => void;
  cambiarMensajeIndividual: (id: string, mensaje: string) => void;
  restaurarMensajeIndividual: (id: string) => void;
  establecerMensajeBase: (mensaje: string) => void;
  establecerMensajeBaseOriginal: (mensaje: string) => void;
  establecerClientesPreparados: (clientes: ClienteWhatsapp[]) => void;
  establecerMensajesIndividuales: (mensajes: MensajesIndividuales) => void;
};

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function esSalidaSinGestor(tipo?: string, propietario = ""): boolean {
  const tipoNormalizado = normalizarTexto(tipo ?? "");
  const propietarioNormalizado = normalizarTexto(propietario);
  return (
    tipoNormalizado.includes("independiente") ||
    tipoNormalizado.includes("supervisor") ||
    propietarioNormalizado.includes("independiente") ||
    propietarioNormalizado.includes("supervisor")
  );
}

export function useWhatsappMensajes({
  propietarioNumeroSalida,
  tipoPropietarioNumeroSalida = "",
  numeroSalida,
  obtenerNumeroContactoGestor,
  obtenerMetadata,
}: {
  propietarioNumeroSalida: string;
  tipoPropietarioNumeroSalida?: string;
  numeroSalida: string;
  obtenerNumeroContactoGestor: (gestorCliente: string) => string;
  obtenerMetadata: (id: string) => MetadataWhatsappSeleccion | undefined;
}): Resultado {
  const [mensajeBase, setMensajeBase] = useState(() =>
    obtenerPlantilla("sin_contacto"),
  );
  const [mensajeBaseOriginal, setMensajeBaseOriginal] = useState(() =>
    obtenerPlantilla("sin_contacto"),
  );
  const [clientesPreparados, setClientesPreparados] = useState<
    ClienteWhatsapp[]
  >([]);
  const [mensajesIndividuales, setMensajesIndividuales] =
    useState<MensajesIndividuales>({});

  const generarMensajeCliente = useCallback(
    (cliente: ClienteWhatsapp, base: string) => {
      const salidaSinGestor = esSalidaSinGestor(
        tipoPropietarioNumeroSalida,
        propietarioNumeroSalida,
      );
      const gestorCliente = cliente.gestor?.trim() ?? "";
      const presentacion = salidaSinGestor
        ? "Le saludamos"
        : gestorCliente
          ? `Le saluda ${gestorCliente}`
          : "Le saludamos";
      const numeroFinal = salidaSinGestor
        ? numeroSalida
        : obtenerNumeroContactoGestor(gestorCliente) || numeroSalida;

      return reemplazarVariablesMensaje(base, {
        cliente: cliente.cliente,
        gestor: gestorCliente,
        presentacion,
        numeroSalida: numeroFinal,
      });
    },
    [
      numeroSalida,
      obtenerNumeroContactoGestor,
      propietarioNumeroSalida,
      tipoPropietarioNumeroSalida,
    ],
  );

  const aplicarMensajeATodos = useCallback(() => {
    const nuevosMensajes: MensajesIndividuales = {};
    for (const cliente of clientesPreparados) {
      const campanaCliente = obtenerMetadata(cliente.id)?.campana;
      const plantillaCliente = campanaCliente
        ? obtenerPlantilla(campanaCliente as PropuestaId)
        : mensajeBase;
      nuevosMensajes[cliente.id] = generarMensajeCliente(
        cliente,
        plantillaCliente,
      );
    }
    setMensajesIndividuales(nuevosMensajes);
  }, [clientesPreparados, generarMensajeCliente, mensajeBase, obtenerMetadata]);

  const cambiarMensajeIndividual = useCallback(
    (id: string, mensaje: string) => {
      setMensajesIndividuales((actuales) => ({ ...actuales, [id]: mensaje }));
    },
    [],
  );

  const restaurarMensajeIndividual = useCallback(
    (id: string) => {
      const cliente = clientesPreparados.find((item) => item.id === id);
      if (!cliente) return;
      const campanaCliente = obtenerMetadata(id)?.campana;
      const plantillaCliente = campanaCliente
        ? obtenerPlantilla(campanaCliente as PropuestaId)
        : mensajeBase;
      setMensajesIndividuales((actuales) => ({
        ...actuales,
        [id]: generarMensajeCliente(cliente, plantillaCliente),
      }));
    },
    [clientesPreparados, generarMensajeCliente, mensajeBase, obtenerMetadata],
  );

  return {
    mensajeBase,
    mensajeBaseOriginal,
    clientesPreparados,
    mensajesIndividuales,
    generarMensajeCliente,
    aplicarMensajeATodos,
    cambiarMensajeIndividual,
    restaurarMensajeIndividual,
    establecerMensajeBase: setMensajeBase,
    establecerMensajeBaseOriginal: setMensajeBaseOriginal,
    establecerClientesPreparados: setClientesPreparados,
    establecerMensajesIndividuales: setMensajesIndividuales,
  };
}
