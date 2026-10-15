"use client";

import { useCallback, useEffect, useState } from "react";
import { useSesion } from "@/components/SesionProvider";
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
import SeleccionTelefonosWhatsapp, {
  telefonosElegiblesWhatsapp,
} from "./SeleccionTelefonosWhatsapp";
import {
  ControlSeguimientoWhatsapp,
  ConfirmarSeguimientosWhatsapp,
} from "./ControlSeguimientoWhatsapp";
import type { ClienteWhatsapp } from "./FilaClienteWhatsapp";
import type { CampanaGuardadaWhatsapp } from "@/lib/whatsapp/campanas";
import type { FiltroSeguimientoWhatsapp } from "@/lib/whatsapp/seguimiento";
import { validarContactoGestorPlantilla } from "@/lib/whatsapp/plantillas";
import {
  obtenerPlantillaPdp,
  obtenerSaludoGestorPdp,
  reemplazarVariablesPdp,
  type CampanaPdpWhatsapp,
} from "@/lib/whatsapp/plantillas-pdp";
import { useWhatsappSeleccion } from "@/hooks/useWhatsappSeleccion";
import { useWhatsappTelefonos } from "@/hooks/useWhatsappTelefonos";
import { useWhatsappCampana } from "@/hooks/useWhatsappCampana";
const STATUS_PDP: Record<CampanaPdpWhatsapp, string> = {
  posible_pago: "Posible Pago",
  cien_confiable: "100% Confiable",
  fin_acuerdo: "Fin de Acuerdo",
};
const hoy = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

    seguimiento: cliente.seguimiento,
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
  const { sesion } = useSesion();
  const [rango, setRango] = useState<RangoWhatsapp>(() => ({
    desde: hoy().slice(0, 7) + "-01",
    hasta: hoy(),
    etiqueta: "Este mes",
  }));
  const [propuesta, setPropuesta] =
      useState<CampanaPdpWhatsapp>("posible_pago"),
    [gestor, setGestor] = useState(""),
    [numeroSalida, setNumeroSalida] = useState(""),
    [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState<ClientePdp[]>([]),
    [cargando, setCargando] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const [seguida, setSeguida] = useState<CampanaGuardadaWhatsapp | null>(null),
    [filtro, setFiltro] = useState<FiltroSeguimientoWhatsapp>("TODOS");
  const [tenor, setTenor] = useState(obtenerPlantillaPdp("posible_pago")),
    [clientesPreparados, setClientesPreparados] = useState<ClienteWhatsapp[]>(
      [],
    ),
    [mensajesIndividuales, setMensajesIndividuales] = useState<
      Record<string, string>
    >({});
  const [clienteRevision, setClienteRevision] =
      useState<ClienteWhatsapp | null>(null),
    [clienteVista, setClienteVista] = useState<ClientePdp | null>(null);
  const [revisionAbierta, setRevisionAbierta] = useState(false),
    [estadoAbierto, setEstadoAbierto] = useState(false),
    [modalAbierto, setModalAbierto] = useState(false),
    [errorAccion, setErrorAccion] = useState("");
  const {
    seleccionados,
    cantidad: cantidadSeleccionados,
    toggle,
    toggleMuchos,
    seleccionar,
    limpiar,
    obtenerMetadata,
  } = useWhatsappSeleccion();
  const telefonos = useWhatsappTelefonos();
  const statusPdp = STATUS_PDP[propuesta];
  const puedeEnviar =
    sesion?.rol === "administrador" || sesion?.rol === "supervisor";
  useEffect(() => {
    const controller = new AbortController();
    let pendiente = false;
    let primera = true;
    const params = new URLSearchParams({
      statusPdp,
      desde: rango.desde,
      hasta: rango.hasta,
      seguimiento: filtro,
    });
    if (gestor) params.set("gestor", gestor);
    if (busqueda.trim()) params.set("q", busqueda.trim());
    if (seguida) params.set("campanaId", String(seguida.id));
    async function cargar() {
      if (pendiente || controller.signal.aborted) return;
      pendiente = true;
      if (primera) {
        setCargando(true);
        primera = false;
      }
      try {
        const r = await fetch("/api/whatsapp/pdps?" + params, {
            cache: "no-store",
            signal: controller.signal,
          }),
          d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "No se pudieron cargar las PDP.");
        if (!controller.signal.aborted) {
          setClientes(d.clientes ?? []);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setClientes([]);
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar las PDP.",
          );
        }
      } finally {
        pendiente = false;
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    const timer = setTimeout(() => void cargar(), 300),
      intervalo = seguida ? setInterval(() => void cargar(), 3000) : null;
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (intervalo) clearInterval(intervalo);
    };
  }, [
    statusPdp,
    rango.desde,
    rango.hasta,
    gestor,
    busqueda,
    seguida,
    version,
    filtro,
  ]);
  function clientePdp(c: ClienteWhatsapp): ClientePdp {
    const actual =
      clientes.find((p) => p.id === c.id || p.idc === c.idc) ??
      (obtenerMetadata(c.id)?.cliente as ClientePdp | undefined);
    return (
      actual ?? {
        id: c.id,
        idc: c.idc,
        cliente: c.cliente,
        gestor: c.gestor,
        statusPdp: null,
        tipo: "",
        moneda: "PEN",
        montoPdp: null,
        montoDolares: null,
        fechaPdp: "",
        estadoPdp: "",
        fechaRegistro: c.ultimaGestion,
        telefonos: c.telefonos,
        telefonoPredeterminado: "",
        seguimiento: c.seguimiento,
      }
    );
  }
  function generarMensajeCliente(c: ClienteWhatsapp, plantilla: string) {
    const p = clientePdp(c),
      gestorCliente = p.gestor ?? "",
      salida = telefonos.numerosWhatsappRegistrados.find(
        (n) => n.numero === numeroSalida,
      );
    return reemplazarVariablesPdp(plantilla, {
      cliente: p.cliente,
      gestor: gestorCliente,
      numeroSalida,
      numeroContactoGestor:
        telefonos.obtenerNumeroContactoGestor(gestorCliente),
      saludoGestor: obtenerSaludoGestorPdp(
        gestorCliente,
        salida?.propietario,
        salida?.propietarioTipo,
      ),
      montoPdp: formatearMontoPdp(p),
      fechaPdp: p.fechaPdp,
    });
  }
  const onGuardada = (id: number) => {
    setSeguida(
      (actual) =>
        actual ?? {
          id,
          campana: "PDP - " + statusPdp,
          estado: "PREPARADA",
          numero_salida: numeroSalida,
          gestor: gestor || null,
          desde: rango.desde,
          hasta: rango.hasta,
          fecha_creacion: new Date().toISOString(),
        },
    );
    const url = new URL(window.location.href);
    url.searchParams.set("campanaPdp", String(id));
    window.history.replaceState(null, "", url);
    setVersion((v) => v + 1);
  };
  const campana = useWhatsappCampana({
    propuestaActual: "PDP - " + statusPdp,
    rango,
    gestor,
    clientes: clientes.map(adaptarClientePdp),
    seleccionados,
    cantidadSeleccionados,
    obtenerMetadata,
    numeroSalida,
    telefonosManuales: telefonos.telefonosManuales,
    telefonosSeleccionados: telefonos.telefonosSeleccionados,
    mensajeBase: tenor,
    mensajesIndividuales,
    generarMensajeCliente,
    validarPlantillaCliente: (cliente, plantilla, mensaje) => {
      const gestorAsignado = clientePdp(cliente).gestor ?? "";
      return validarContactoGestorPlantilla(
        plantilla,
        mensaje,
        telefonos.obtenerNumeroContactoGestor(gestorAsignado),
        gestorAsignado,
      );
    },
    setClientesPreparados,
    setMensajesIndividuales,
    setMensajeBaseOriginal: () => {},
    setClienteRevision,
    setEstadoAbierto,
    setRevisionAbierta,
    setClienteVista: () => setClienteVista(null),
    onError: setErrorAccion,
    campanaSeguimientoId: seguida?.id,
    nombreCampanaGuardada: seguida?.campana,
    onGuardada,
    puedeEnviar,
    onFinalizar: () => {
      setVersion((v) => v + 1);
      limpiar();
      telefonos.limpiarTelefonos();
    },
    resolverClientes: async () => {
      const mapa = new Map(clientes.map((c) => [c.id, c]));
      const tipos = [
        ...new Set(
          seleccionados
            .map((id) => obtenerMetadata(id)?.campana)
            .filter(Boolean),
        ),
      ];
      for (const tipo of tipos) {
        const params = new URLSearchParams({
          statusPdp: STATUS_PDP[tipo as CampanaPdpWhatsapp],
          desde: rango.desde,
          hasta: rango.hasta,
        });
        if (gestor) params.set("gestor", gestor);
        if (seguida) params.set("campanaId", String(seguida.id));
        const r = await fetch("/api/whatsapp/pdps?" + params, {
            cache: "no-store",
          }),
          d = await r.json();
        if (!r.ok)
          throw new Error(d.error ?? "No se pudieron validar las PDP.");
        for (const c of d.clientes as ClientePdp[]) mapa.set(c.id, c);
      }
      return seleccionados
        .map((id) => mapa.get(id))
        .filter((c): c is ClientePdp => !!c)
        .map(adaptarClientePdp);
    },
    plantillaCliente: (c) => {
      const tipo = obtenerMetadata(c.id)?.campana;
      return tipo ? obtenerPlantillaPdp(tipo as CampanaPdpWhatsapp) : tenor;
    },
    adaptarClientesGuardados: (lista) =>
      lista.map((c) => {
        const p = clientes.find((p) => p.idc === c.idc);
        return p ? { ...adaptarClientePdp(p), seguimiento: c.seguimiento } : c;
      }),
  });
  const reiniciar = campana.reiniciarEstadoCampana,
    limpiarTelefonos = telefonos.limpiarTelefonos;
  const cambiarSeguimiento = useCallback(
    (guardada: CampanaGuardadaWhatsapp | null) => {
      setSeguida(guardada);
      setFiltro("TODOS");
      setBusqueda("");
      limpiar();
      limpiarTelefonos();
      reiniciar();
      setErrorAccion("");
      if (guardada) {
        setRango({
          desde: guardada.desde,
          hasta: guardada.hasta,
          etiqueta: "Rango de campaña",
        });
        setGestor(guardada.gestor ?? "");
        setNumeroSalida(guardada.numero_salida);
        const p = (Object.keys(STATUS_PDP) as CampanaPdpWhatsapp[]).find(
          (k) => guardada.campana === "PDP - " + STATUS_PDP[k],
        );
        if (p) {
          setPropuesta(p);
          setTenor(obtenerPlantillaPdp(p));
        }
      }
    },
    [limpiar, limpiarTelefonos, reiniciar],
  );
  const ocupado = campana.preparando || campana.enviandoCampana;
  function asegurar(id: string) {
    const c = clientes.find((c) => c.id === id);
    if (c && !seleccionados.includes(id))
      seleccionar([id], { [id]: { campana: propuesta, cliente: c } });
  }
  const onTelefono = (id: string, n: string) => {
    asegurar(id);
    telefonos.cambiarTelefono(id, n);
  };
  const onSeleccionarTelefonos = (id: string, ns: string[]) => {
    if (ns.length) asegurar(id);
    telefonos.seleccionarTelefonos(id, ns);
  };
  const onAgregarManual = (id: string, n: string) => {
    asegurar(id);
    telefonos.agregarTelefonoManual(id, n);
  };
  const metadata = Object.fromEntries(
    clientes.map((c) => [c.id, { campana: propuesta, cliente: c }]),
  );
  function alternarCliente(id: string) {
    const cliente = clientes.find((c) => c.id === id);
    const quitar = seleccionados.includes(id);
    toggle(id, metadata[id]);
    if (cliente)
      telefonos.seleccionarTelefonos(
        id,
        quitar
          ? []
          : telefonosElegiblesWhatsapp(
              cliente,
              telefonos.telefonosManuales[id] ?? [],
            ),
      );
  }
  function alternarClientes(ids: string[]) {
    const quitar = ids.length > 0 && ids.every((id) => seleccionados.includes(id));
    toggleMuchos(ids, metadata);
    for (const cliente of clientes.filter((c) => ids.includes(c.id)))
      telefonos.seleccionarTelefonos(
        cliente.id,
        quitar
          ? []
          : telefonosElegiblesWhatsapp(
              cliente,
              telefonos.telefonosManuales[cliente.id] ?? [],
            ),
      );
  }
  const tabla = {
    seleccionados,
    cargando,
    error,
    telefonosSeleccionados: telefonos.telefonosSeleccionados,
    telefonosManuales: telefonos.telefonosManuales,
    onToggle: alternarCliente,
    onTelefono,
    onSeleccionarTelefonos,
    onAgregarManual,
    soloSinExito: filtro === "SIN_EXITO",
    disabled: ocupado,
  };
  function seleccionarPendientes() {
    limpiar();
    const ids: string[] = [];
    for (const c of clientes) {
      const ns =
        c.seguimiento?.telefonos
          .filter((t) => t.estado === "PENDIENTE")
          .map((t) => t.numero) ?? [];
      if (ns.length) {
        ids.push(c.id);
        telefonos.seleccionarTelefonos(c.id, ns);
      }
    }
    seleccionar(ids, metadata);
    if (!ids.length)
      setErrorAccion("No hay teléfonos pendientes en esta lista.");
  }
  async function revisarGuardada() {
    const d = await campana.revisarCampanaGuardada();
    if (!d) return;
    limpiar();
    seleccionar(
      d.clientes.map((c) => c.id),
      Object.fromEntries(
        d.clientes.map((c) => [
          c.id,
          { campana: propuesta, cliente: clientePdp(c) },
        ]),
      ),
    );
    for (const c of d.clientes)
      telefonos.seleccionarTelefonos(
        c.id,
        d.destinatarios
          .filter((r) => r.idc === c.idc)
          .map((r) => r.telefono_destino),
      );
  }
  return (
    <>
      <div className="space-y-4">
        <section className="tarjeta p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Configuración del envío</h2>
          <fieldset
            disabled={ocupado}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <SelectorRangoWhatsapp valor={rango} onChange={setRango} />
            <SelectorGestorWhatsapp valor={gestor} onChange={setGestor} />
            <label className="whatsapp-label">
              País
              <select className="whatsapp-select mt-1">
                <option>Perú (+51)</option>
              </select>
            </label>
            <SelectorNumeroSalida
              valor={numeroSalida}
              onChange={setNumeroSalida}
            />
          </fieldset>
        </section>
        <CampanasPdpWhatsapp
          valor={propuesta}
          onChange={(p) => {
            if (!ocupado) {
              setPropuesta(p);
              setTenor(obtenerPlantillaPdp(p));
              setBusqueda("");
            }
          }}
        />
        <ControlSeguimientoWhatsapp
          modulo="pdps"
          valor={seguida?.id ?? null}
          onChange={cambiarSeguimiento}
          filtro={filtro}
          onFiltro={setFiltro}
          version={version}
          disabled={ocupado}
          onPendientes={seleccionarPendientes}
          onRevisar={() => void revisarGuardada()}
        />
        {(errorAccion || campana.errorCampana) && (
          <p
            role="alert"
            className="tarjeta p-3 text-sm"
            style={{ color: "var(--color-error)" }}
          >
            {errorAccion || campana.errorCampana}
          </p>
        )}
        <BarraClientesWhatsapp
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          recientes={Math.min(clientes.length, 10)}
          total={clientes.length}
          seleccionados={cantidadSeleccionados}
          rango={rango.etiqueta}
          onVerMas={() => setModalAbierto(true)}
        />
        <section className="tarjeta overflow-hidden">
          <div className="flex justify-between gap-3 p-4">
            <h2 className="font-semibold">Últimos clientes PDP</h2>
            <button
              type="button"
              className="boton-secundario"
              disabled={ocupado || !clientes.length}
              onClick={() => alternarClientes(clientes.map((c) => c.id))}
            >
              {clientes.length > 0 &&
              clientes.every((c) => seleccionados.includes(c.id))
                ? "Quitar selección"
                : "Seleccionar clientes"}
            </button>
          </div>
          <TablaClientesPdpWhatsapp
            clientes={clientes.slice(0, 10)}
            {...tabla}
            onVistaPrevia={setClienteVista}
          />
          <div className="flex justify-between border-t p-4">
            <span>{cantidadSeleccionados} clientes seleccionados</span>
            <button
              type="button"
              className="text-sm"
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
          onPreparar={campana.prepararEnvio}
        />
      </div>
      {modalAbierto && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/45 p-4">
          <section className="tarjeta mx-auto max-w-7xl overflow-hidden">
            <div className="flex justify-between p-4">
              <h2 className="font-semibold">Todos los clientes PDP</h2>
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
              {...tabla}
              onVistaPrevia={(c) => {
                setClienteVista(c);
                setModalAbierto(false);
              }}
            />
          </section>
        </div>
      )}
      {clienteVista && !revisionAbierta && (
        <div className="fixed inset-0 z-[115] overflow-y-auto bg-black/45 p-4">
          <div className="mx-auto max-w-3xl">
            <VistaPreviaWhatsapp
              cliente={adaptarClientePdp(clienteVista)}
              numeroSalida={numeroSalida}
              numeroDestino={telefonos.telefonoDestino(
                adaptarClientePdp(clienteVista),
              )}
              mensaje={
                mensajesIndividuales[clienteVista.id] ??
                generarMensajeCliente(adaptarClientePdp(clienteVista), tenor)
              }
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
        procesados={campana.procesados}
        preparados={campana.preparados}
        sinTelefono={campana.sinTelefono}
        fallidos={campana.fallidos}
        inciertos={campana.inciertos}
        preparando={campana.preparando}
        enviando={campana.enviandoCampana}
        onCerrar={() => setEstadoAbierto(false)}
      />
      <RevisionEnvioWhatsapp
        abierto={revisionAbierta}
        modoBorrador
        puedeEnviar={puedeEnviar}
        clientes={clientesPreparados}
        mensajes={mensajesIndividuales}
        mensajeBase={tenor}
        mensajeBaseOriginal={obtenerPlantillaPdp(propuesta)}
        numeroSalida={numeroSalida}
        campanaId={campana.campanaId}
        seleccionados={clientesPreparados.map((c) => c.id)}
        preparados={campana.preparados}
        sinTelefono={campana.sinTelefono}
        fallidos={campana.fallidos}
        clienteActivo={clienteRevision}
        numeroDestinoActivo={
          clienteRevision ? telefonos.telefonoDestino(clienteRevision) : ""
        }
        onMensajeBaseChange={setTenor}
        onAplicarATodos={() =>
          setMensajesIndividuales(
            Object.fromEntries(
              clientesPreparados.map((c) => [
                c.id,
                generarMensajeCliente(c, tenor),
              ]),
            ),
          )
        }
        onSeleccionarCliente={setClienteRevision}
        onMensajeIndividualChange={(id, m) =>
          setMensajesIndividuales((actual) => ({ ...actual, [id]: m }))
        }
        onRestaurarIndividual={(id) => {
          const c = clientesPreparados.find((c) => c.id === id);
          if (c)
            setMensajesIndividuales((actual) => ({
              ...actual,
              [id]: generarMensajeCliente(
                c,
                obtenerPlantillaPdp(
                  (obtenerMetadata(id)?.campana as CampanaPdpWhatsapp) ??
                    propuesta,
                ),
              ),
            }));
        }}
        onCerrarPreview={() => setClienteRevision(null)}
        onConfirmar={campana.confirmarCampaña}
        onCerrar={() => setRevisionAbierta(false)}
        enviando={campana.enviandoCampana}
        telefonosElegidos={telefonos.telefonosSeleccionados}
        error={campana.errorCampana || campana.errorSeleccion}
        advertencias={
          <ConfirmarSeguimientosWhatsapp
            {...campana.advertencias}
            valor={campana.confirmaciones}
            onChange={campana.setConfirmaciones}
            disabled={campana.enviandoCampana}
          />
        }
        selectorTelefonos={
          clienteRevision && (
            <SeleccionTelefonosWhatsapp
              cliente={clienteRevision}
              seleccionados={
                telefonos.telefonosSeleccionados[clienteRevision.id] ?? []
              }
              manuales={telefonos.telefonosManuales[clienteRevision.id] ?? []}
              onToggle={(n) => telefonos.cambiarTelefono(clienteRevision.id, n)}
              onSeleccionar={(ns) =>
                telefonos.seleccionarTelefonos(clienteRevision.id, ns)
              }
              onAgregarManual={(n) =>
                telefonos.agregarTelefonoManual(clienteRevision.id, n)
              }
              disabled={campana.enviandoCampana}
            />
          )
        }
      />
    </>
  );
}
