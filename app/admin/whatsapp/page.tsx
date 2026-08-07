// app/admin/whatsapp/page.tsx
//
// Orquestador de WhatsApp Masivo.
//
// La página concentra únicamente el estado de UI y composición.
// La lógica pesada está separada en hooks especializados.
//
// Flujo real:
// Configuración → Selección → Preparación → Historial → Revisión
// → POST /api/whatsapp/enviar → Playwright → WhatsApp Web.
//
// IMPORTANTE: los endpoints y payloads del backend no se modifican.

"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import HeaderPanelAdmin from "@/components/HeaderPanelAdmin";
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
import SelectorRangoWhatsapp, {
  type RangoWhatsapp,
} from "@/components/whatsapp/SelectorRangoWhatsapp";
import SelectorNumeroSalida from "@/components/whatsapp/SelectorNumeroSalida";
import SelectorGestorWhatsapp from "@/components/whatsapp/SelectorGestorWhatsapp";
import type { ClienteWhatsapp } from "@/components/whatsapp/FilaClienteWhatsapp";

import { obtenerPlantilla } from "@/lib/whatsapp/plantillas";
import { useWhatsappClientes } from "@/hooks/useWhatsappClientes";
import { useWhatsappSeleccion } from "@/hooks/useWhatsappSeleccion";
import { useWhatsappTelefonos } from "@/hooks/useWhatsappTelefonos";
import { useWhatsappMensajes } from "@/hooks/useWhatsappMensajes";
import { useWhatsappCampana } from "@/hooks/useWhatsappCampana";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioMes(): string {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

const NOMBRES_CAMPAÑA: Record<PropuestaId, string> = {
  sin_contacto: "Sin contacto",
  acuerdo_pago: "Acuerdo de pago",
  contactados: "Contactados",
  renuente: "Renuente",
  remate_proceso: "Remate / Proceso judicial",
  casos_especiales: "Casos especiales",
};

export default function WhatsappPage() {
  const [modulo, setModulo] = useState<ModuloWhatsapp>("gestiones");
  const [propuesta, setPropuesta] = useState<PropuestaId>("sin_contacto");
  const [rango, setRango] = useState<RangoWhatsapp>({
    desde: inicioMes(),
    hasta: hoy(),
    etiqueta: "Este mes",
  });
  const [gestor, setGestor] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [numeroSalida, setNumeroSalida] = useState("");
  const [propietarioNumeroSalida, setPropietarioNumeroSalida] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteVista, setClienteVista] = useState<ClienteWhatsapp | null>(
    null,
  );
  const [estadoAbierto, setEstadoAbierto] = useState(false);
  const [revisionAbierta, setRevisionAbierta] = useState(false);
  const [clienteRevision, setClienteRevision] =
    useState<ClienteWhatsapp | null>(null);

  const {
    seleccionados,
    cantidad: cantidadSeleccionados,
    toggle,
    toggleMuchos,
    obtenerMetadata,
  } = useWhatsappSeleccion();

  const { clientes, total, cargando, error } = useWhatsappClientes({
    campana: propuesta,
    desde: rango.desde,
    hasta: rango.hasta,
    gestor,
    busqueda,
    vista: "recientes",
  });

  const {
    numerosWhatsappRegistrados,
    telefonosSeleccionados,
    telefonosManuales,
    usarTelefonoManual,
    cambiarTelefono,
    cambiarTelefonoManual,
    usarManual,
    volverRegistrado,
    telefonoDestino,
    obtenerNumeroContactoGestor,
  } = useWhatsappTelefonos();

  const tipoPropietarioNumeroSalida =
    numerosWhatsappRegistrados.find((item) => item.numero === numeroSalida)
      ?.propietarioTipo ?? "";

  const {
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
  } = useWhatsappMensajes({
    propietarioNumeroSalida,
    tipoPropietarioNumeroSalida,
    numeroSalida,
    obtenerNumeroContactoGestor,
    obtenerMetadata,
  });

  const {
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
  } = useWhatsappCampana({
    propuestaActual: NOMBRES_CAMPAÑA[propuesta],
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
  });

  const propuestaActual = NOMBRES_CAMPAÑA[propuesta];

  function cambiarCampaña(nueva: PropuestaId) {
    const nuevaPlantilla = obtenerPlantilla(nueva);

    setPropuesta(nueva);
    setMensajeBase(nuevaPlantilla);
    setMensajeBaseOriginal(nuevaPlantilla);
    setBusqueda("");
    setClienteVista(null);
    setClienteRevision(null);
    setModalAbierto(false);
    setEstadoAbierto(false);
    setRevisionAbierta(false);
    setClientesPreparados([]);
    setMensajesIndividuales({});
    reiniciarEstadoCampana();
  }

  function cambiarGestor(nuevoGestor: string) {
    setGestor(nuevoGestor);
    setBusqueda("");
    setClienteVista(null);
    setClienteRevision(null);
    setModalAbierto(false);
    reiniciarEstadoCampana();
  }

  function seleccionarClienteRevision(cliente: ClienteWhatsapp) {
    setClienteRevision(cliente);
  }

  const idsRecientes = clientes.map((cliente) => cliente.id);
  const todosRecientesSeleccionados =
    clientes.length > 0 &&
    idsRecientes.every((id) => seleccionados.includes(id));

  function toggleTodosRecientes() {
    const metadataPorId: Record<
      string,
      { campana: string; cliente?: unknown }
    > = {};

    for (const cliente of clientes) {
      metadataPorId[cliente.id] = {
        campana: propuesta,
        cliente,
      };
    }

    toggleMuchos(idsRecientes, metadataPorId);
  }

  return (
    <>
      <div className="p-4 sm:p-5 md:p-6">
        <HeaderPanelAdmin
          titulo="WhatsApp Masivo"
          descripcion="Gestiona mensajes segmentados para clientes de la cartera."
        />

        <div className="mt-4 space-y-4">
          <PestanasWhatsapp valor={modulo} onChange={setModulo} />

          {modulo === "pdps" ? (
            <PestanaPdpWhatsapp />
          ) : modulo === "exportar_mensajes" ? (
            <ExportarMensajesWhatsapp />
          ) : (
            <>
              <section className="tarjeta p-4 sm:p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold">
                    Configuración del envío
                  </h2>

                  <p
                    className="mt-1 text-sm"
                    style={{
                      color: "var(--color-texto-suave)",
                    }}
                  >
                    Define el rango, gestor y número desde el que se realizará
                    la campaña.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SelectorRangoWhatsapp valor={rango} onChange={setRango} />

                  <SelectorGestorWhatsapp
                    valor={gestor}
                    onChange={cambiarGestor}
                  />

                  <div>
                    <label className="whatsapp-label">País</label>

                    <select className="whatsapp-select mt-1">
                      <option>Perú (+51)</option>
                    </select>
                  </div>

                  <SelectorNumeroSalida
                    valor={numeroSalida}
                    onChange={setNumeroSalida}
                    onPropietarioChange={setPropietarioNumeroSalida}
                  />
                </div>
              </section>

              <CampanasWhatsapp valor={propuesta} onChange={cambiarCampaña} />

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
                <div
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  style={{
                    borderBottom: "1px solid var(--color-borde)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="whatsapp-icono">
                      <MessageCircle size={18} />
                    </div>

                    <div>
                      <h2 className="text-base font-semibold">
                        Últimos clientes gestionados
                      </h2>

                      <p
                        className="mt-1 text-xs"
                        style={{
                          color: "var(--color-texto-suave)",
                        }}
                      >
                        {propuestaActual}

                        {gestor ? ` · ${gestor}` : ""}

                        {" · últimos clientes dentro del rango."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="boton-secundario"
                    disabled={!clientes.length}
                    onClick={toggleTodosRecientes}
                  >
                    {todosRecientesSeleccionados
                      ? "Quitar selección"
                      : "Seleccionar todos"}
                  </button>
                </div>

                <TablaClientesWhatsapp
                  clientes={clientes}
                  seleccionados={seleccionados}
                  cargando={cargando}
                  error={error}
                  onToggle={(id) => {
                    const cliente = clientes.find((item) => item.id === id);

                    toggle(id, {
                      campana: propuesta,

                      cliente,
                    });
                  }}
                  onTelefono={cambiarTelefono}
                  onTelefonoManual={cambiarTelefonoManual}
                  onUsarManual={usarManual}
                  onVolverRegistrado={volverRegistrado}
                  onVistaPrevia={(cliente) => {
                    setClienteVista(cliente);
                  }}
                  telefonosSeleccionados={telefonosSeleccionados}
                  telefonosManuales={telefonosManuales}
                  usarTelefonoManual={usarTelefonoManual}
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
                campaña={propuestaActual}
                gestor={gestor}
                rango={rango.etiqueta}
                numeroSalida={numeroSalida}
                onPreparar={prepararEnvio}
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
        onToggle={(id) => {
          const cliente = clientes.find((item) => item.id === id);

          toggle(id, {
            campana: propuesta,

            cliente,
          });
        }}
        onToggleMuchos={(ids) => {
          const metadataPorId: Record<
            string,
            {
              campana: string;
              cliente?: unknown;
            }
          > = {};

          for (const id of ids) {
            metadataPorId[id] = {
              campana: propuesta,

              cliente: clientes.find((item) => item.id === id),
            };
          }

          toggleMuchos(ids, metadataPorId);
        }}
        telefonosSeleccionados={telefonosSeleccionados}
        telefonosManuales={telefonosManuales}
        usarTelefonoManual={usarTelefonoManual}
        onTelefono={cambiarTelefono}
        onTelefonoManual={cambiarTelefonoManual}
        onUsarManual={usarManual}
        onVolverRegistrado={volverRegistrado}
        onVistaPrevia={(cliente) => {
          setClienteVista(cliente);

          setModalAbierto(false);
        }}
      />

      <EstadoEnvioWhatsapp
        abierto={estadoAbierto}
        campaña={propuestaActual}
        gestor={gestor}
        numeroSalida={numeroSalida}
        total={cantidadSeleccionados}
        procesados={procesados}
        preparados={preparados}
        sinTelefono={sinTelefono}
        fallidos={fallidos}
        preparando={preparando || enviandoCampana}
        onCerrar={() => setEstadoAbierto(false)}
      />

      {clienteVista && !revisionAbierta && (
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
              cliente={clienteVista}
              numeroSalida={numeroSalida}
              numeroDestino={telefonoDestino(clienteVista)}
              mensaje={generarMensajeCliente(
                clienteVista,
                obtenerMetadata(clienteVista.id)?.campana
                  ? obtenerPlantilla(
                      obtenerMetadata(clienteVista.id)!.campana as PropuestaId,
                    )
                  : mensajeBase,
              )}
              onCerrar={() => setClienteVista(null)}
            />
          </div>
        </div>
      )}

      <RevisionEnvioWhatsapp
        abierto={revisionAbierta}
        clientes={clientesPreparados}
        mensajes={mensajesIndividuales}
        mensajeBase={mensajeBase}
        mensajeBaseOriginal={mensajeBaseOriginal}
        numeroSalida={numeroSalida}
        seleccionados={clientesPreparados.map((cliente) => cliente.id)}
        preparados={preparados}
        sinTelefono={sinTelefono}
        fallidos={fallidos}
        clienteActivo={clienteRevision}
        numeroDestinoActivo={
          clienteRevision ? telefonoDestino(clienteRevision) : ""
        }
        campanaId={campanaId}
        enviando={enviandoCampana}
        onMensajeBaseChange={setMensajeBase}
        onAplicarATodos={aplicarMensajeATodos}
        onSeleccionarCliente={seleccionarClienteRevision}
        onMensajeIndividualChange={cambiarMensajeIndividual}
        onRestaurarIndividual={restaurarMensajeIndividual}
        onCerrarPreview={() => setClienteRevision(null)}
        onConfirmar={confirmarCampaña}
        onCerrar={() => setRevisionAbierta(false)}
      />
    </>
  );
}
