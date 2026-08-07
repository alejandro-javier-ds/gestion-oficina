// components/whatsapp/PestanaPdpWhatsapp.tsx
// Flujo completo de WhatsApp Masivo para PDPs.
// "Confirmar campaña" solamente termina la revisión.

"use client";

import { useEffect, useState } from "react";

import { HandCoins } from "lucide-react";

import SelectorRangoWhatsapp, {
  type RangoWhatsapp,
} from "./SelectorRangoWhatsapp";

import SelectorGestorWhatsapp from "./SelectorGestorWhatsapp";

import SelectorNumeroSalida from "./SelectorNumeroSalida";

import CampanasPdpWhatsapp from "./CampanasPdpWhatsapp";

import BarraClientesWhatsapp from "./BarraClientesWhatsapp";

import TablaClientesPdpWhatsapp, {
  type ClientePdp,
} from "./TablaClientesPdpWhatsapp";

import VistaPreviaWhatsapp from "./VistaPreviaWhatsapp";

import ResumenEnvioWhatsapp from "./ResumenEnvioWhatsapp";

import EstadoEnvioWhatsapp from "./EstadoEnvioWhatsapp";

import RevisionEnvioWhatsapp from "./RevisionEnvioWhatsapp";

import type { ClienteWhatsapp } from "./FilaClienteWhatsapp";

import {
  obtenerPlantillaPdp,
  obtenerSaludoGestorPdp,
  reemplazarVariablesPdp,
  type CampanaPdpWhatsapp,
} from "@/lib/whatsapp/plantillas-pdp";

import { useWhatsappSeleccion } from "@/hooks/useWhatsappSeleccion";

type RespuestaPdp = {
  total: number;
  clientes: ClientePdp[];
};

type MensajesIndividuales = Record<string, string>;

type NumeroWhatsappRegistrado = {
  numero: string;
  propietario: string;
  propietarioTipo?: string;
  activo?: number;
};

function normalizarTextoWhatsapp(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type DestinatarioHistorial = {
  idc: string;
  cliente: string;
  gestor: string | null;
  telefonoDestino: string;
  tipoTelefono: string;
  estado: string;
  error: string | null;
  mensaje: string;
  tenor?: string | null;
};

function obtenerHoyLocal(): string {
  const fecha = new Date();

  const year = fecha.getFullYear();

  const month = String(fecha.getMonth() + 1).padStart(2, "0");

  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function obtenerInicioMesLocal(): string {
  const fecha = new Date();

  const year = fecha.getFullYear();

  const month = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

function rangoInicialPdp(): RangoWhatsapp {
  return {
    desde: obtenerInicioMesLocal(),

    hasta: obtenerHoyLocal(),

    etiqueta: "Este mes",
  };
}

const STATUS_PDP: Record<CampanaPdpWhatsapp, string> = {
  posible_pago: "Posible Pago",

  cien_confiable: "100% Confiable",

  fin_acuerdo: "Fin de Acuerdo",
};

function adaptarClientePdp(cliente: ClientePdp): ClienteWhatsapp {
  return {
    id: cliente.id,

    idc: cliente.idc,

    cliente: cliente.cliente,

    gestor: cliente.gestor,

    segmentacion: cliente.statusPdp,

    campana: "pdp",

    ultimaGestion: cliente.fechaRegistro,

    telefonoUltimaGestion: cliente.telefonoPredeterminado || null,

    telefonos: cliente.telefonos.map((telefono) => ({
      id_phone: telefono.id_phone,

      idc: cliente.idc,

      phone: telefono.phone,

      tipo_telefono: telefono.tipo_telefono,

      agregado_manualmente: 0,

      activo: telefono.activo,

      qtty_phone_ranking: telefono.qtty_phone_ranking,
    })),

    pdp: {
      statusPdp: cliente.statusPdp,

      tipo: cliente.tipo,

      moneda: cliente.moneda,

      montoPdp: cliente.montoPdp,

      montoDolares: cliente.montoDolares,

      fechaPdp: cliente.fechaPdp,

      estadoPdp: cliente.estadoPdp,
    },
  };
}

function formatearMontoPdp(cliente: ClientePdp): string {
  if (cliente.montoPdp === null || cliente.montoPdp === undefined) {
    return "";
  }

  const moneda = cliente.moneda?.trim().toUpperCase();

  const simbolo = moneda === "USD" ? "$" : "S/";

  return `${simbolo} ${cliente.montoPdp.toLocaleString("es-PE", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
}

export default function PestanaPdpWhatsapp() {
  const [rango, setRango] = useState<RangoWhatsapp>(rangoInicialPdp());

  const [campana, setCampana] = useState<CampanaPdpWhatsapp>("posible_pago");

  const [gestor, setGestor] = useState("");

  const [numeroSalida, setNumeroSalida] = useState("");

  const [numerosWhatsappRegistrados, setNumerosWhatsappRegistrados] = useState<
    NumeroWhatsappRegistrado[]
  >([]);

  useEffect(() => {
    let activo = true;

    async function cargarNumerosWhatsapp() {
      try {
        const response = await fetch("/api/whatsapp/playwright/estados", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          numeros?: NumeroWhatsappRegistrado[];
        };

        if (activo) {
          setNumerosWhatsappRegistrados(data.numeros ?? []);
        }
      } catch {
        if (activo) {
          setNumerosWhatsappRegistrados([]);
        }
      }
    }

    void cargarNumerosWhatsapp();

    const intervalo = window.setInterval(() => {
      void cargarNumerosWhatsapp();
    }, 10_000);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  function obtenerNumeroContactoGestor(gestorCliente: string): string {
    const gestorNormalizado = normalizarTextoWhatsapp(gestorCliente);

    if (!gestorNormalizado) {
      return "";
    }

    const numero = numerosWhatsappRegistrados.find(
      (item) =>
        item.activo !== 0 &&
        normalizarTextoWhatsapp(item.propietario) === gestorNormalizado,
    );

    return numero?.numero ?? "";
  }

  function obtenerSalidaSeleccionada(): NumeroWhatsappRegistrado | null {
    const numeroNormalizado = normalizarTextoWhatsapp(numeroSalida);

    if (!numeroNormalizado) {
      return null;
    }

    return (
      numerosWhatsappRegistrados.find(
        (item) =>
          item.activo !== 0 &&
          normalizarTextoWhatsapp(item.numero) === numeroNormalizado,
      ) ?? null
    );
  }

  const [busqueda, setBusqueda] = useState("");

  const [clientes, setClientes] = useState<ClientePdp[]>([]);

  const [total, setTotal] = useState(0);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [tenor, setTenor] = useState(obtenerPlantillaPdp("posible_pago"));

  const [telefonosSeleccionados, setTelefonosSeleccionados] = useState<
    Record<string, string>
  >({});

  const [telefonosManuales, setTelefonosManuales] = useState<
    Record<string, string>
  >({});

  const [usarTelefonoManual, setUsarTelefonoManual] = useState<
    Record<string, boolean>
  >({});

  const [campanaId, setCampanaId] = useState<number | null>(null);

  const [enviandoCampana, setEnviandoCampana] = useState(false);

  const {
    seleccionados,
    cantidad: cantidadSeleccionados,
    toggle,
    toggleMuchos,
    obtenerMetadata,
  } = useWhatsappSeleccion();

  const [clientesPreparados, setClientesPreparados] = useState<
    ClienteWhatsapp[]
  >([]);

  const [mensajesIndividuales, setMensajesIndividuales] =
    useState<MensajesIndividuales>({});

  const [clienteRevision, setClienteRevision] =
    useState<ClienteWhatsapp | null>(null);

  const [revisionAbierta, setRevisionAbierta] = useState(false);

  const [estadoAbierto, setEstadoAbierto] = useState(false);

  const [preparando, setPreparando] = useState(false);

  const [procesados, setProcesados] = useState(0);

  const [preparados, setPreparados] = useState(0);

  const [sinTelefono, setSinTelefono] = useState(0);

  const [fallidos, setFallidos] = useState(0);

  const [modalAbierto, setModalAbierto] = useState(false);

  const [clienteVista, setClienteVista] = useState<ClientePdp | null>(null);

  const statusPdp = STATUS_PDP[campana];

  function cambiarCampana(nueva: CampanaPdpWhatsapp) {
    setCampana(nueva);

    setTenor(obtenerPlantillaPdp(nueva));

    setBusqueda("");

    setClienteVista(null);

    setClienteRevision(null);

    setClientesPreparados([]);

    setMensajesIndividuales({});

    setRevisionAbierta(false);

    setEstadoAbierto(false);

    setModalAbierto(false);
  }

  function cambiarGestor(nuevoGestor: string) {
    setGestor(nuevoGestor);

    setBusqueda("");

    setClienteVista(null);

    setClienteRevision(null);

    setModalAbierto(false);

    setTelefonosSeleccionados({});

    setTelefonosManuales({});

    setUsarTelefonoManual({});
  }

  function cambiarRango(nuevoRango: RangoWhatsapp) {
    setRango(nuevoRango);

    setClienteVista(null);

    setClienteRevision(null);

    setModalAbierto(false);

    setTelefonosSeleccionados({});

    setTelefonosManuales({});

    setUsarTelefonoManual({});
  }

  useEffect(() => {
    let cancelado = false;

    async function cargarClientes() {
      setCargando(true);

      setError("");

      try {
        const params = new URLSearchParams();

        params.set("statusPdp", statusPdp);

        params.set("desde", rango.desde);

        params.set("hasta", rango.hasta);

        if (gestor) {
          params.set("gestor", gestor);
        }

        if (busqueda.trim()) {
          params.set("q", busqueda.trim());
        }

        const response = await fetch(
          `/api/whatsapp/pdps?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

        const data = (await response.json().catch(() => null)) as
          | RespuestaPdp
          | {
              error?: string;
            }
          | null;

        if (!response.ok) {
          throw new Error(
            data && "error" in data
              ? (data.error ?? "No se pudieron cargar los clientes PDP.")
              : "No se pudieron cargar los clientes PDP.",
          );
        }

        if (cancelado) {
          return;
        }

        const resultado = data as RespuestaPdp;

        setClientes(
          Array.isArray(resultado.clientes) ? resultado.clientes : [],
        );

        setTotal(resultado.total ?? 0);
      } catch (errorCarga) {
        if (cancelado) {
          return;
        }

        console.error("Error cargando PDPs:", errorCarga);

        setClientes([]);

        setTotal(0);

        setError(
          errorCarga instanceof Error
            ? errorCarga.message
            : "No se pudieron cargar los clientes PDP.",
        );
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    void cargarClientes();

    return () => {
      cancelado = true;
    };
  }, [statusPdp, gestor, busqueda, rango.desde, rango.hasta]);

  const clientesVisibles = clientes.slice(0, 10);

  const idsClientes = clientes.map((cliente) => cliente.id);

  const todosSeleccionados =
    clientes.length > 0 &&
    idsClientes.every((id) => seleccionados.includes(id));

  function seleccionarTodos() {
    const metadataPorId: Record<
      string,
      {
        campana: string;
        cliente?: unknown;
      }
    > = {};

    for (const cliente of clientes) {
      metadataPorId[cliente.id] = {
        campana,
        cliente,
      };
    }

    toggleMuchos(idsClientes, metadataPorId);
  }

  function cambiarTelefono(id: string, telefonoId: string) {
    setUsarTelefonoManual((actuales) => ({
      ...actuales,
      [id]: false,
    }));

    setTelefonosSeleccionados((actuales) => ({
      ...actuales,
      [id]: telefonoId,
    }));
  }

  function cambiarTelefonoManual(id: string, valor: string) {
    const limpio = valor.replace(/\D/g, "").replace(/^51/, "").slice(0, 9);

    setTelefonosManuales((actuales) => ({
      ...actuales,
      [id]: limpio,
    }));
  }

  function usarManual(id: string) {
    setUsarTelefonoManual((actuales) => ({
      ...actuales,
      [id]: true,
    }));
  }

  function volverRegistrado(id: string) {
    setUsarTelefonoManual((actuales) => ({
      ...actuales,
      [id]: false,
    }));
  }

  function obtenerTelefonoDestino(cliente: ClientePdp): string {
    const usaManual = usarTelefonoManual[cliente.id] ?? false;

    if (usaManual) {
      return telefonosManuales[cliente.id] ?? "";
    }

    const telefonoElegido = telefonosSeleccionados[cliente.id];

    if (telefonoElegido) {
      return (
        cliente.telefonos.find(
          (telefono) => String(telefono.id_phone) === telefonoElegido,
        )?.phone ?? ""
      );
    }

    return (
      cliente.telefonos.find(
        (telefono) =>
          telefono.activo === 1 &&
          telefono.tipo_telefono.toLowerCase() === "celular",
      )?.phone ?? ""
    );
  }

  function generarMensajeCliente(
    cliente: ClientePdp,
    plantilla: string = tenor,
  ): string {
    const gestorCliente = cliente.gestor ?? "";

    const numeroContactoGestor = obtenerNumeroContactoGestor(gestorCliente);

    return reemplazarVariablesPdp(plantilla, {
      cliente: cliente.cliente,

      gestor: gestorCliente,

      numeroSalida: numeroSalida,

      numeroContactoGestor: numeroContactoGestor,

      saludoGestor: obtenerSaludoGestorPdp(
        gestorCliente,
        obtenerSalidaSeleccionada()?.propietario,
        obtenerSalidaSeleccionada()?.propietarioTipo,
      ),

      montoPdp: formatearMontoPdp(cliente),

      fechaPdp: cliente.fechaPdp,
    });
  }

  function generarMensajesParaTodos(
    lista: ClientePdp[],
    plantilla: string = tenor,
  ): MensajesIndividuales {
    const mensajes: MensajesIndividuales = {};

    lista.forEach((cliente) => {
      const metadata = obtenerMetadata(cliente.id);

      const campanaCliente = metadata?.campana;

      const plantillaCliente = campanaCliente
        ? obtenerPlantillaPdp(campanaCliente as CampanaPdpWhatsapp)
        : plantilla;

      mensajes[cliente.id] = generarMensajeCliente(cliente, plantillaCliente);
    });

    return mensajes;
  }

  function aplicarMensajeATodos() {
    const nuevosMensajes: MensajesIndividuales = {};

    for (const id of seleccionados) {
      const metadata = obtenerMetadata(id);

      const clientePdp = metadata?.cliente as ClientePdp | undefined;

      if (!clientePdp) {
        continue;
      }

      const campanaCliente = metadata?.campana;

      const plantillaCliente = campanaCliente
        ? obtenerPlantillaPdp(campanaCliente as CampanaPdpWhatsapp)
        : tenor;

      nuevosMensajes[id] = generarMensajeCliente(clientePdp, plantillaCliente);
    }

    setMensajesIndividuales(nuevosMensajes);
  }

  function obtenerNombreCampanaHistorial(
    campanasSeleccionadas: Array<string | undefined>,
  ): string {
    const unicas = Array.from(new Set(campanasSeleccionadas.filter(Boolean)));

    if (unicas.length === 1) {
      return STATUS_PDP[unicas[0] as CampanaPdpWhatsapp] ?? unicas[0];
    }

    return "Selección mixta";
  }

  async function prepararEnvio() {
    if (cantidadSeleccionados === 0 || !numeroSalida) {
      return;
    }

    setProcesados(0);
    setPreparados(0);
    setSinTelefono(0);
    setFallidos(0);

    setEstadoAbierto(true);

    setPreparando(true);

    try {
      const clientesPorId = new Map<string, ClientePdp>();

      for (const cliente of clientes) {
        clientesPorId.set(cliente.id, cliente);
      }

      const clientesSeleccionados = seleccionados
        .map((id) => {
          const clienteActual = clientesPorId.get(id);

          if (clienteActual) {
            return clienteActual;
          }

          const metadata = obtenerMetadata(id);

          return metadata?.cliente as ClientePdp | undefined;
        })
        .filter((cliente): cliente is ClientePdp => Boolean(cliente));

      const preparadosLocal: ClienteWhatsapp[] = [];

      const mensajes: MensajesIndividuales = {};

      const destinatarios: DestinatarioHistorial[] = [];

      let procesadosActuales = 0;

      let preparadosActuales = 0;

      let sinTelefonoActuales = 0;

      let fallidosActuales = 0;

      for (const cliente of clientesSeleccionados) {
        const metadata = obtenerMetadata(cliente.id);

        const campanaCliente = metadata?.campana;

        const plantillaCliente = campanaCliente
          ? obtenerPlantillaPdp(campanaCliente as CampanaPdpWhatsapp)
          : tenor;

        let destino = "";

        let tipoTelefono = "";

        let estado = "PREPARADO";

        let errorDestinatario: string | null = null;

        try {
          const usaManual = usarTelefonoManual[cliente.id] ?? false;

          if (usaManual) {
            destino = (telefonosManuales[cliente.id] ?? "")
              .replace(/\D/g, "")
              .replace(/^51/, "");

            tipoTelefono = "manual";
          } else {
            const telefonoElegido = telefonosSeleccionados[cliente.id];

            const registrado = telefonoElegido
              ? cliente.telefonos.find(
                  (telefono) => String(telefono.id_phone) === telefonoElegido,
                )
              : null;

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

          const valido = /^9\d{8}$/.test(destino);

          if (!valido) {
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

        const mensajeFinal =
          mensajesIndividuales[cliente.id] ??
          generarMensajeCliente(cliente, plantillaCliente);

        mensajes[cliente.id] = mensajeFinal;

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

        preparadosLocal.push(adaptarClientePdp(cliente));

        procesadosActuales++;

        setProcesados(procesadosActuales);

        setPreparados(preparadosActuales);

        setSinTelefono(sinTelefonoActuales);

        setFallidos(fallidosActuales);

        await new Promise((resolve) => setTimeout(resolve, 35));
      }

      const responseHistorial = await fetch("/api/whatsapp/historial", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          campana: `PDP - ${obtenerNombreCampanaHistorial(
            seleccionados.map((id) => obtenerMetadata(id)?.campana),
          )}`,

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
        const data = (await responseHistorial.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          data?.error ??
            "La campaña PDP fue preparada pero no se pudo guardar el historial.",
        );
      }

      const dataHistorial = (await responseHistorial.json()) as {
        ok: boolean;
        id: number;
        estado: string;
      };

      if (!dataHistorial.id) {
        throw new Error(
          "La campaña PDP fue guardada, pero el servidor no devolvió un ID válido.",
        );
      }

      setCampanaId(dataHistorial.id);

      setClientesPreparados(preparadosLocal);

      setMensajesIndividuales(mensajes);

      setClienteRevision(preparadosLocal[0] ?? null);

      setEstadoAbierto(false);

      setRevisionAbierta(true);
    } catch (errorPreparando) {
      console.error("Error preparando PDP:", errorPreparando);

      setFallidos((actual) => actual + 1);
    } finally {
      setPreparando(false);
    }
  }

  function cambiarMensajeIndividual(id: string, nuevoMensaje: string) {
    setMensajesIndividuales((actuales) => ({
      ...actuales,
      [id]: nuevoMensaje,
    }));
  }

  function restaurarMensajeIndividual(id: string) {
    const cliente = clientesPreparados.find((item) => item.id === id);

    if (!cliente) {
      return;
    }

    const clientePdp = clientes.find((item) => item.id === id);

    if (!clientePdp) {
      return;
    }

    const campanaCliente = obtenerMetadata(id)?.campana;

    const plantillaCliente = campanaCliente
      ? obtenerPlantillaPdp(campanaCliente as CampanaPdpWhatsapp)
      : tenor;

    setMensajesIndividuales((actuales) => ({
      ...actuales,
      [id]: generarMensajeCliente(clientePdp, plantillaCliente),
    }));
  }

  async function confirmarCampaña() {
    if (enviandoCampana) {
      return;
    }

    if (!campanaId) {
      console.error("[WhatsApp PDP] No existe campanaId.");
      return;
    }

    setEnviandoCampana(true);
    setEstadoAbierto(true);

    try {
      const response = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campanaId }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo enviar la campaña PDP.");
      }

      setRevisionAbierta(false);
      setClienteRevision(null);
      setClienteVista(null);
      setEstadoAbierto(false);
    } catch (errorEnvio) {
      console.error("[WhatsApp PDP] Error enviando campaña:", errorEnvio);
    } finally {
      setEnviandoCampana(false);
    }
  }

  const clienteRevisionPdp = clienteRevision
    ? (clientes.find((cliente) => cliente.id === clienteRevision.id) ?? null)
    : null;

  const telefonoRevision = clienteRevisionPdp
    ? obtenerTelefonoDestino(clienteRevisionPdp)
    : "";

  const mensajeBaseOriginal = obtenerPlantillaPdp(campana);

  return (
    <>
      <div className="space-y-4">
        <section className="tarjeta p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Configuración del envío</h2>

            <p
              className="mt-1 text-sm"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Define el rango, gestor y número desde el que se realizará la
              campaña.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectorRangoWhatsapp valor={rango} onChange={cambiarRango} />

            <SelectorGestorWhatsapp valor={gestor} onChange={cambiarGestor} />

            <div>
              <label className="whatsapp-label">País</label>

              <select
                value="+51"
                className="whatsapp-select mt-1"
                onChange={() => {}}
              >
                <option value="+51">Perú (+51)</option>
              </select>
            </div>

            <SelectorNumeroSalida
              valor={numeroSalida}
              onChange={setNumeroSalida}
            />
          </div>
        </section>

        <CampanasPdpWhatsapp valor={campana} onChange={cambiarCampana} />

        <BarraClientesWhatsapp
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          recientes={clientesVisibles.length}
          total={total}
          seleccionados={cantidadSeleccionados}
          rango={rango.etiqueta}
          onVerMas={() => setModalAbierto(true)}
        />

        <section className="tarjeta overflow-hidden">
          <div
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            style={{
              borderBottom: "1px solid var(--color-borde)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="whatsapp-icono">
                <HandCoins size={18} />
              </div>

              <div>
                <h2 className="text-base font-semibold">
                  Últimos clientes PDP
                </h2>

                <p
                  className="mt-1 text-xs"
                  style={{
                    color: "var(--color-texto-suave)",
                  }}
                >
                  {statusPdp}
                  {" · "}
                  {rango.etiqueta}
                  {" · últimos clientes dentro del rango."}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="boton-secundario"
              disabled={!clientes.length}
              onClick={seleccionarTodos}
            >
              {todosSeleccionados ? "Quitar selección" : "Seleccionar todos"}
            </button>
          </div>

          <TablaClientesPdpWhatsapp
            clientes={clientesVisibles}
            seleccionados={seleccionados}
            cargando={cargando}
            error={error}
            telefonosSeleccionados={telefonosSeleccionados}
            telefonosManuales={telefonosManuales}
            usarTelefonoManual={usarTelefonoManual}
            onToggle={(id) => {
              const cliente = clientes.find((item) => item.id === id);

              toggle(id, {
                campana,
                cliente,
              });
            }}
            onTelefono={cambiarTelefono}
            onTelefonoManual={cambiarTelefonoManual}
            onUsarManual={usarManual}
            onVolverRegistrado={volverRegistrado}
            onVistaPrevia={setClienteVista}
          />

          <div
            className="flex items-center justify-between border-t p-4 sm:p-5"
            style={{
              borderColor: "var(--color-borde)",
            }}
          >
            <span className="text-sm font-medium">
              {cantidadSeleccionados} seleccionados
            </span>

            <button
              type="button"
              className="text-sm font-medium"
              style={{
                color: "var(--color-accion)",
              }}
              onClick={() => setModalAbierto(true)}
            >
              Ver todos los clientes
            </button>
          </div>
        </section>

        <ResumenEnvioWhatsapp
          seleccionados={cantidadSeleccionados}
          campaña={statusPdp}
          gestor={gestor}
          rango={rango.etiqueta}
          numeroSalida={numeroSalida}
          onPreparar={prepararEnvio}
        />
      </div>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/45 p-4 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalAbierto(false);
            }
          }}
        >
          <div className="mx-auto w-full max-w-7xl">
            <section className="tarjeta overflow-hidden">
              <div
                className="flex items-start justify-between gap-4 border-b p-4 sm:p-5"
                style={{
                  borderColor: "var(--color-borde)",
                }}
              >
                <div>
                  <h2 className="text-base font-semibold">
                    Todos los clientes PDP
                  </h2>

                  <p
                    className="mt-1 text-xs"
                    style={{
                      color: "var(--color-texto-suave)",
                    }}
                  >
                    {statusPdp}
                    {" · "}
                    {rango.etiqueta}
                    {" · "}
                    {total} encontrados.
                  </p>
                </div>

                <button
                  type="button"
                  className="boton-secundario"
                  onClick={() => setModalAbierto(false)}
                >
                  Cerrar
                </button>
              </div>

              <TablaClientesPdpWhatsapp
                clientes={clientes}
                seleccionados={seleccionados}
                cargando={cargando}
                error={error}
                telefonosSeleccionados={telefonosSeleccionados}
                telefonosManuales={telefonosManuales}
                usarTelefonoManual={usarTelefonoManual}
                onToggle={(id) => {
                  const cliente = clientes.find((item) => item.id === id);

                  toggle(id, {
                    campana,
                    cliente,
                  });
                }}
                onTelefono={cambiarTelefono}
                onTelefonoManual={cambiarTelefonoManual}
                onUsarManual={usarManual}
                onVolverRegistrado={volverRegistrado}
                onVistaPrevia={(cliente) => {
                  setClienteVista(cliente);

                  setModalAbierto(false);
                }}
              />
            </section>
          </div>
        </div>
      )}

      {clienteVista && (
        <div
          className="fixed inset-0 z-[115] overflow-y-auto bg-black/45 p-4 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setClienteVista(null);
            }
          }}
        >
          <div className="mx-auto max-w-3xl">
            <VistaPreviaWhatsapp
              cliente={adaptarClientePdp(clienteVista)}
              numeroSalida={numeroSalida}
              numeroDestino={obtenerTelefonoDestino(clienteVista)}
              mensaje={
                mensajesIndividuales[clienteVista.id] ??
                generarMensajeCliente(
                  clienteVista,
                  obtenerMetadata(clienteVista.id)?.campana
                    ? obtenerPlantillaPdp(
                        obtenerMetadata(clienteVista.id)!
                          .campana as CampanaPdpWhatsapp,
                      )
                    : tenor,
                )
              }
              editable={false}
              onCerrar={() => setClienteVista(null)}
            />
          </div>
        </div>
      )}

      <EstadoEnvioWhatsapp
        abierto={estadoAbierto}
        campaña={statusPdp}
        gestor={gestor}
        numeroSalida={numeroSalida}
        total={cantidadSeleccionados}
        procesados={procesados}
        preparados={preparados}
        sinTelefono={sinTelefono}
        fallidos={fallidos}
        preparando={preparando}
        onCerrar={() => setEstadoAbierto(false)}
      />

      <RevisionEnvioWhatsapp
        abierto={revisionAbierta}
        clientes={clientesPreparados}
        mensajes={mensajesIndividuales}
        mensajeBase={tenor}
        mensajeBaseOriginal={mensajeBaseOriginal}
        numeroSalida={numeroSalida}
        campanaId={campanaId}
        seleccionados={clientesPreparados.map((cliente) => cliente.id)}
        preparados={preparados}
        sinTelefono={sinTelefono}
        fallidos={fallidos}
        clienteActivo={clienteRevision}
        numeroDestinoActivo={telefonoRevision}
        onMensajeBaseChange={(nuevoMensaje) => {
          setTenor(nuevoMensaje);
        }}
        onAplicarATodos={aplicarMensajeATodos}
        onSeleccionarCliente={setClienteRevision}
        onMensajeIndividualChange={cambiarMensajeIndividual}
        onRestaurarIndividual={restaurarMensajeIndividual}
        onCerrarPreview={() => setClienteRevision(null)}
        onConfirmar={confirmarCampaña}
        onCerrar={() => setRevisionAbierta(false)}
      />
    </>
  );
}
