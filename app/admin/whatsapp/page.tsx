"use client";

import { useCallback, useState } from "react";
import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";
import { useSesion } from "@/components/SesionProvider";
import PestanasWhatsapp, {
  type ModuloWhatsapp,
} from "@/components/whatsapp/PestanasWhatsapp";
import PestanaPdpWhatsapp from "@/components/whatsapp/PestanaPdpWhatsapp";
import ExportarMensajesWhatsapp from "@/components/whatsapp/ExportarMensajesWhatsapp";
import CampanasWhatsapp, {
  type PropuestaId,
} from "@/components/whatsapp/CampanasWhatsapp";
import BarraClientesWhatsapp from "@/components/whatsapp/BarraClientesWhatsapp";
import TablaClientesWhatsapp from "@/components/whatsapp/TablaClientesWhatsapp";
import ModalClientesWhatsapp from "@/components/whatsapp/ModalClientesWhatsapp";
import VistaPreviaWhatsapp from "@/components/whatsapp/VistaPreviaWhatsapp";
import ResumenEnvioWhatsapp from "@/components/whatsapp/ResumenEnvioWhatsapp";
import EstadoEnvioWhatsapp from "@/components/whatsapp/EstadoEnvioWhatsapp";
import RevisionEnvioWhatsapp from "@/components/whatsapp/RevisionEnvioWhatsapp";
import SeleccionTelefonosWhatsapp, {
  telefonosElegiblesWhatsapp,
} from "@/components/whatsapp/SeleccionTelefonosWhatsapp";
import {
  ControlSeguimientoWhatsapp,
  ConfirmarSeguimientosWhatsapp,
} from "@/components/whatsapp/ControlSeguimientoWhatsapp";
import SelectorRangoWhatsapp, {
  type RangoWhatsapp,
} from "@/components/whatsapp/SelectorRangoWhatsapp";
import SelectorNumeroSalida from "@/components/whatsapp/SelectorNumeroSalida";
import SelectorGestorWhatsapp from "@/components/whatsapp/SelectorGestorWhatsapp";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";
import type { CampanaGuardadaWhatsapp } from "@/lib/whatsapp/campanas";
import {
  celularesActivosWhatsapp,
  type FiltroSeguimientoWhatsapp,
} from "@/lib/whatsapp/seguimiento";
import {
  obtenerPlantilla,
  validarContactoGestorPlantilla,
} from "@/lib/whatsapp/plantillas";
import { useWhatsappClientes } from "@/hooks/useWhatsappClientes";
import { useWhatsappSeleccion } from "@/hooks/useWhatsappSeleccion";
import { useWhatsappTelefonos } from "@/hooks/useWhatsappTelefonos";
import { useWhatsappMensajes } from "@/hooks/useWhatsappMensajes";
import { useWhatsappCampana } from "@/hooks/useWhatsappCampana";
const NOMBRES: Record<PropuestaId, string> = {
  sin_contacto: "Sin contacto",
  acuerdo_pago: "Acuerdo de pago",
  contactados: "Contactados",
  renuente: "Renuente",
  remate_proceso: "Remate / Proceso judicial",
  casos_especiales: "Casos especiales",
};
const hoy = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function WhatsappPage() {
  const { sesion } = useSesion();
  const [modulo, setModulo] = useState<ModuloWhatsapp>("gestiones"),
    [propuesta, setPropuesta] = useState<PropuestaId>("sin_contacto");
  const [rango, setRango] = useState<RangoWhatsapp>(() => ({
    desde: hoy().slice(0, 7) + "-01",
    hasta: hoy(),
    etiqueta: "Este mes",
  }));
  const [gestor, setGestor] = useState(""),
    [busqueda, setBusqueda] = useState(""),
    [numeroSalida, setNumeroSalida] = useState(""),
    [propietarioNumeroSalida, setPropietarioNumeroSalida] = useState("");
  const [seguida, setSeguida] = useState<CampanaGuardadaWhatsapp | null>(null),
    [filtro, setFiltro] = useState<FiltroSeguimientoWhatsapp>("TODOS"),
    [version, setVersion] = useState(0);
  const [listaOcupada, setListaOcupada] = useState(false),
    [errorAccion, setErrorAccion] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false),
    [estadoAbierto, setEstadoAbierto] = useState(false),
    [revisionAbierta, setRevisionAbierta] = useState(false);
  const [clienteVista, setClienteVista] = useState<ClienteWhatsapp | null>(
      null,
    ),
    [clienteRevision, setClienteRevision] = useState<ClienteWhatsapp | null>(
      null,
    );
  const {
    seleccionados,
    cantidad: cantidadSeleccionados,
    toggle,
    toggleMuchos,
    seleccionar,
    limpiar,
    obtenerMetadata,
  } = useWhatsappSeleccion();
  const telefonos = useWhatsappTelefonos(modulo === "gestiones");
  const { clientes, total, cargando, error } = useWhatsappClientes({
    campana: propuesta,
    desde: rango.desde,
    hasta: rango.hasta,
    gestor,
    busqueda,
    activo: modulo === "gestiones",
    campanaId: seguida?.id,
    seguimiento: filtro,
    refresco: version,
  });
  const mensajes = useWhatsappMensajes({
    propietarioNumeroSalida,
    tipoPropietarioNumeroSalida:
      telefonos.numerosWhatsappRegistrados.find(
        (n) => n.numero === numeroSalida,
      )?.propietarioTipo ?? "",
    numeroSalida,
    obtenerNumeroContactoGestor: telefonos.obtenerNumeroContactoGestor,
    obtenerMetadata,
  });
  const puedeEnviar =
    sesion?.rol === "administrador" || sesion?.rol === "supervisor";
  const onGuardada = (id: number) => {
    setSeguida(
      (actual) =>
        actual ?? {
          id,
          campana: NOMBRES[propuesta],
          estado: "PREPARADA",
          numero_salida: numeroSalida,
          gestor: gestor || null,
          desde: rango.desde,
          hasta: rango.hasta,
          fecha_creacion: new Date().toISOString(),
        },
    );
    const url = new URL(window.location.href);
    url.searchParams.set("campanaGestiones", String(id));
    window.history.replaceState(null, "", url);
    setVersion((v) => v + 1);
  };
  const campana = useWhatsappCampana({
    propuestaActual: NOMBRES[propuesta],
    rango,
    gestor,
    clientes,
    seleccionados,
    cantidadSeleccionados,
    obtenerMetadata,
    numeroSalida,
    telefonosManuales: telefonos.telefonosManuales,
    telefonosSeleccionados: telefonos.telefonosSeleccionados,
    mensajeBase: mensajes.mensajeBase,
    mensajesIndividuales: mensajes.mensajesIndividuales,
    generarMensajeCliente: mensajes.generarMensajeCliente,
    validarPlantillaCliente: (cliente, plantilla, mensaje) => {
      const gestorAsignado = cliente.gestor ?? "";
      return validarContactoGestorPlantilla(
        plantilla,
        mensaje,
        telefonos.obtenerNumeroContactoGestor(gestorAsignado),
        gestorAsignado,
      );
    },
    setClientesPreparados: mensajes.establecerClientesPreparados,
    setMensajesIndividuales: mensajes.establecerMensajesIndividuales,
    setMensajeBaseOriginal: mensajes.establecerMensajeBaseOriginal,
    setClienteRevision,
    setEstadoAbierto,
    setRevisionAbierta,
    setClienteVista,
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
        const clave = (Object.keys(NOMBRES) as PropuestaId[]).find(
          (k) => NOMBRES[k] === guardada.campana,
        );
        if (clave) setPropuesta(clave);
      }
    },
    [limpiar, limpiarTelefonos, reiniciar],
  );
  const ocupado = listaOcupada || campana.preparando || campana.enviandoCampana;
  function asegurarSeleccion(id: string, cliente?: ClienteWhatsapp) {
    if (cliente && !seleccionados.includes(id))
      seleccionar([id], { [id]: { campana: propuesta, cliente } });
  }
  const onTelefono = (id: string, n: string, c?: ClienteWhatsapp) => {
    asegurarSeleccion(id, c);
    telefonos.cambiarTelefono(id, n);
  };
  const onSeleccionarTelefonos = (
    id: string,
    n: string[],
    c?: ClienteWhatsapp,
  ) => {
    if (n.length) asegurarSeleccion(id, c);
    telefonos.seleccionarTelefonos(id, n);
  };
  const onAgregarManual = (id: string, n: string, c?: ClienteWhatsapp) => {
    asegurarSeleccion(id, c);
    telefonos.agregarTelefonoManual(id, n);
  };
  function toggleCliente(id: string, c?: ClienteWhatsapp) {
    const quitar = seleccionados.includes(id);
    toggle(id, { campana: propuesta, cliente: c });
    if (c)
      telefonos.seleccionarTelefonos(
        id,
        quitar
          ? []
          : telefonosElegiblesWhatsapp(
              c,
              telefonos.telefonosManuales[id] ?? [],
            ),
      );
  }
  function toggleClientes(ids: string[], lista: ClienteWhatsapp[] = clientes) {
    const quitar = ids.length > 0 && ids.every((id) => seleccionados.includes(id));
    toggleMuchos(
      ids,
      Object.fromEntries(
        lista.map((c) => [c.id, { campana: propuesta, cliente: c }]),
      ),
    );
    for (const c of lista.filter((cliente) => ids.includes(cliente.id)))
      telefonos.seleccionarTelefonos(
        c.id,
        quitar
          ? []
          : telefonosElegiblesWhatsapp(
              c,
              telefonos.telefonosManuales[c.id] ?? [],
            ),
      );
  }
  async function seleccionarPendientes() {
    if (ocupado) return;
    setListaOcupada(true);
    setErrorAccion("");
    try {
      const params = new URLSearchParams({
        campana: propuesta,
        vista: "todos",
        desde: rango.desde,
        hasta: rango.hasta,
        seguimiento: filtro,
      });
      if (gestor) params.set("gestor", gestor);
      if (busqueda.trim()) params.set("q", busqueda.trim());
      if (seguida) params.set("campanaId", String(seguida.id));
      const r = await fetch("/api/whatsapp/clientes?" + params, {
          cache: "no-store",
        }),
        d = await r.json();
      if (!r.ok)
        throw new Error(
          d.error ?? "No se pudieron seleccionar los pendientes.",
        );
      limpiar();
      const metadata: Record<
        string,
        { campana: string; cliente: ClienteWhatsapp }
      > = {};
      const ids: string[] = [];
      for (const c of d.clientes as ClienteWhatsapp[]) {
        const ns =
          c.seguimiento?.telefonos
            .filter((t) => t.estado === "PENDIENTE")
            .map((t) => t.numero) ??
          celularesActivosWhatsapp(c.telefonos).map((t) => t.phone);
        if (ns.length) {
          ids.push(c.id);
          metadata[c.id] = { campana: propuesta, cliente: c };
          telefonos.seleccionarTelefonos(c.id, ns);
        }
      }
      seleccionar(ids, metadata);
      if (!ids.length)
        setErrorAccion("No hay teléfonos pendientes en esta lista.");
    } catch (e) {
      setErrorAccion(
        e instanceof Error
          ? e.message
          : "No se pudieron seleccionar los pendientes.",
      );
    } finally {
      setListaOcupada(false);
    }
  }
  async function revisarGuardada() {
    const data = await campana.revisarCampanaGuardada();
    if (!data) return;
    limpiar();
    seleccionar(
      data.clientes.map((c) => c.id),
      Object.fromEntries(
        data.clientes.map((c) => [c.id, { campana: propuesta, cliente: c }]),
      ),
    );
    for (const c of data.clientes)
      telefonos.seleccionarTelefonos(
        c.id,
        data.destinatarios
          .filter((d) => d.idc === c.idc)
          .map((d) => d.telefono_destino),
      );
  }
  const tabla = {
    seleccionados,
    cargando,
    error,
    onToggle: toggleCliente,
    onTelefono,
    onSeleccionarTelefonos,
    onAgregarManual,
    telefonosSeleccionados: telefonos.telefonosSeleccionados,
    telefonosManuales: telefonos.telefonosManuales,
    disabled: ocupado,
    soloSinExito: filtro === "SIN_EXITO",
  };
  return (
    <>
      <div className="p-4 sm:p-5 md:p-6">
        <HeaderPanelAdmin
          titulo="WhatsApp Masivo"
          descripcion="Gestiona mensajes segmentados para clientes de la cartera."
        />
        <div className="mt-4 space-y-4">
          <PestanasWhatsapp
            valor={modulo}
            onChange={(m) => {
              if (!ocupado) setModulo(m);
            }}
          />
          {modulo === "pdps" ? (
            <PestanaPdpWhatsapp />
          ) : modulo === "exportar_mensajes" ? (
            <ExportarMensajesWhatsapp />
          ) : (
            <>
              <section className="tarjeta p-4 sm:p-5">
                <h2 className="mb-3 text-base font-semibold">
                  Configuración del envío
                </h2>
                <fieldset
                  disabled={ocupado}
                  className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                >
                  <SelectorRangoWhatsapp valor={rango} onChange={setRango} />
                  <SelectorGestorWhatsapp
                    valor={gestor}
                    onChange={(g) => {
                      setGestor(g);
                      setBusqueda("");
                    }}
                  />
                  <label className="whatsapp-label">
                    País
                    <select className="whatsapp-select mt-1">
                      <option>Perú (+51)</option>
                    </select>
                  </label>
                  <SelectorNumeroSalida
                    valor={numeroSalida}
                    onChange={setNumeroSalida}
                    onPropietarioChange={setPropietarioNumeroSalida}
                  />
                </fieldset>
              </section>
              <CampanasWhatsapp
                valor={propuesta}
                onChange={(p) => {
                  if (ocupado) return;
                  setPropuesta(p);
                  mensajes.establecerMensajeBase(obtenerPlantilla(p));
                  mensajes.establecerMensajeBaseOriginal(obtenerPlantilla(p));
                  setBusqueda("");
                }}
              />
              <ControlSeguimientoWhatsapp
                modulo="gestiones"
                valor={seguida?.id ?? null}
                onChange={cambiarSeguimiento}
                filtro={filtro}
                onFiltro={setFiltro}
                version={version}
                disabled={ocupado}
                onPendientes={() => void seleccionarPendientes()}
                onRevisar={() => void revisarGuardada()}
              />
              {(errorAccion || campana.errorCampana) && (
                <p
                  role="alert"
                  className="tarjeta p-4 text-sm"
                  style={{ color: "var(--color-error)" }}
                >
                  {errorAccion || campana.errorCampana}
                </p>
              )}
              <BarraClientesWhatsapp
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                recientes={clientes.length}
                total={total}
                seleccionados={cantidadSeleccionados}
                rango={rango.etiqueta}
                onVerMas={() => setModalAbierto(true)}
              />
              <section className="tarjeta overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                  <h2 className="font-semibold">
                    Últimos clientes gestionados
                  </h2>
                  <button
                    type="button"
                    className="boton-secundario"
                    disabled={ocupado || !clientes.length}
                    onClick={() => toggleClientes(clientes.map((c) => c.id))}
                  >
                    {clientes.length > 0 &&
                    clientes.every((c) => seleccionados.includes(c.id))
                      ? "Quitar selección"
                      : "Seleccionar clientes visibles"}
                  </button>
                </div>
                <TablaClientesWhatsapp
                  clientes={clientes}
                  {...tabla}
                  onVistaPrevia={setClienteVista}
                />
                <div className="flex justify-between gap-3 border-t p-4">
                  <span>{cantidadSeleccionados} clientes seleccionados</span>
                  <button
                    type="button"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-accion)" }}
                    onClick={() => setModalAbierto(true)}
                  >
                    Ver todos los clientes
                  </button>
                </div>
              </section>
              <ResumenEnvioWhatsapp
                seleccionados={cantidadSeleccionados}
                campaña={seguida?.campana ?? NOMBRES[propuesta]}
                gestor={gestor}
                rango={rango.etiqueta}
                numeroSalida={numeroSalida}
                onPreparar={campana.prepararEnvio}
              />
            </>
          )}
        </div>
      </div>
      <ModalClientesWhatsapp
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        campana={propuesta}
        desde={rango.desde}
        hasta={rango.hasta}
        gestor={gestor}
        seleccionados={seleccionados}
        onToggle={toggleCliente}
        onToggleMuchos={toggleClientes}
        telefonosSeleccionados={telefonos.telefonosSeleccionados}
        telefonosManuales={telefonos.telefonosManuales}
        onTelefono={onTelefono}
        onSeleccionarTelefonos={onSeleccionarTelefonos}
        onAgregarManual={onAgregarManual}
        onVistaPrevia={(c) => {
          setClienteVista(c);
          setModalAbierto(false);
        }}
        campanaId={seguida?.id}
        seguimiento={filtro}
        refresco={version}
        disabled={ocupado}
      />
      <EstadoEnvioWhatsapp
        abierto={estadoAbierto}
        campaña={seguida?.campana ?? NOMBRES[propuesta]}
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
      {clienteVista && !revisionAbierta && (
        <div className="fixed inset-0 z-[115] overflow-y-auto bg-black/45 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <VistaPreviaWhatsapp
              cliente={clienteVista}
              numeroSalida={numeroSalida}
              numeroDestino={telefonos.telefonoDestino(clienteVista)}
              mensaje={mensajes.generarMensajeCliente(
                clienteVista,
                obtenerPlantilla(propuesta),
              )}
              onCerrar={() => setClienteVista(null)}
            />
          </div>
        </div>
      )}
      <RevisionEnvioWhatsapp
        abierto={revisionAbierta}
        modoBorrador
        puedeEnviar={puedeEnviar}
        clientes={mensajes.clientesPreparados}
        mensajes={mensajes.mensajesIndividuales}
        mensajeBase={mensajes.mensajeBase}
        mensajeBaseOriginal={mensajes.mensajeBaseOriginal}
        numeroSalida={numeroSalida}
        seleccionados={mensajes.clientesPreparados.map((c) => c.id)}
        preparados={campana.preparados}
        sinTelefono={campana.sinTelefono}
        fallidos={campana.fallidos}
        clienteActivo={clienteRevision}
        numeroDestinoActivo={
          clienteRevision ? telefonos.telefonoDestino(clienteRevision) : ""
        }
        campanaId={campana.campanaId}
        enviando={campana.enviandoCampana}
        onMensajeBaseChange={mensajes.establecerMensajeBase}
        onAplicarATodos={() =>
          mensajes.establecerMensajesIndividuales(
            Object.fromEntries(
              mensajes.clientesPreparados.map((c) => [
                c.id,
                mensajes.generarMensajeCliente(c, mensajes.mensajeBase),
              ]),
            ),
          )
        }
        onSeleccionarCliente={setClienteRevision}
        onMensajeIndividualChange={mensajes.cambiarMensajeIndividual}
        onRestaurarIndividual={mensajes.restaurarMensajeIndividual}
        onCerrarPreview={() => setClienteRevision(null)}
        onConfirmar={campana.confirmarCampaña}
        onCerrar={() => setRevisionAbierta(false)}
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
