"use client";

import { useEffect, useRef, useState } from "react";
import type RFB from "@novnc/novnc";
import type { EstadoSesionWhatsapp } from "@/lib/whatsapp/playwright";

export default function VisorWhatsapp({ numero, temporal }: { numero: string; temporal: boolean }) {
  const pantalla = useRef<HTMLDivElement>(null);
  const visor = useRef<RFB | null>(null);
  const modo = useRef(true);
  const [soloVer, setSoloVer] = useState(true);
  const [intento, setIntento] = useState(0);
  const [ventana, setVentana] = useState("Preparando la ventana de WhatsApp…");
  const [error, setError] = useState("");
  const [estado, setEstado] = useState<EstadoSesionWhatsapp | null>(null);

  useEffect(() => {
    const contenedor = pantalla.current;
    let detenido = false;
    let conectado = false;
    let reintentos = 0;
    let consultandoEstado = false;
    let recarga: ReturnType<typeof setTimeout> | undefined;
    let consulta: ReturnType<typeof setTimeout> | undefined;
    let limiteConexion: ReturnType<typeof setTimeout> | undefined;
    const controlador = new AbortController();
    const detener = (mensaje: string) => {
      detenido = true;
      clearTimeout(recarga); clearTimeout(consulta); clearTimeout(limiteConexion);
      visor.current?.disconnect();
      pantalla.current?.replaceChildren();
      setError(mensaje);
      setVentana("Ventana desconectada");
    };
    async function consultarEstado() {
      if (detenido || consultandoEstado) return;
      consultandoEstado = true;
      clearTimeout(consulta);
      try {
        const respuesta = await fetch("/api/whatsapp/playwright/estado?numero=" + numero, {
          cache: "no-store", signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(10_000)]),
        });
        const datos = await respuesta.json();
        if (detenido) return;
        if (respuesta.status === 401 || respuesta.status === 403) { detener(datos.error ?? "Tu acceso a esta sesión terminó."); return; }
        if (respuesta.ok) setEstado(datos);
      } catch {}
      finally { consultandoEstado = false; }
      if (!detenido) consulta = setTimeout(() => void consultarEstado(), 10_000);
    }
    async function abrir() {
      try {
        const respuesta = await fetch("/api/whatsapp/visor/preparar", {
          method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numero, temporal }),
          signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(120_000)]),
        });
        const datos = await respuesta.json() as EstadoSesionWhatsapp & { conexion?: string; error?: string };
        if (detenido) return;
        if (!respuesta.ok) { detener(datos.error ?? "No se pudo abrir la ventana remota."); return; }
        setEstado(datos); setError("");
        if (!datos.conexion?.startsWith("/api/whatsapp/visor/conexion?")) throw new Error("Visor no disponible");
        const { default: ClienteRFB } = await import("@novnc/novnc");
        if (detenido || !pantalla.current) return;
        const url = new URL(datos.conexion, window.location.origin);
        url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const canal = new WebSocket(url);
        let revocado = false;
        canal.addEventListener("close", (evento) => { revocado = evento.code === 4003; });
        const cliente = new ClienteRFB(pantalla.current, canal, { shared: true });
        visor.current = cliente;
        cliente.scaleViewport = true;
        cliente.resizeSession = false;
        cliente.viewOnly = modo.current;
        limiteConexion = setTimeout(() => detener("No se pudo conectar el visor. Comprueba el origen HTTPS configurado y el ingreso HTTP de Azure."), 15_000);
        cliente.addEventListener("connect", () => {
          if (detenido) return;
          conectado = true; reintentos = 0; clearTimeout(limiteConexion);
          setVentana("Ventana remota conectada");
        });
        cliente.addEventListener("disconnect", async () => {
          conectado = false; clearTimeout(limiteConexion);
          if (detenido) return;
          pantalla.current?.replaceChildren();
          if (revocado) {
            try {
              const acceso = await fetch("/api/whatsapp/playwright/estado?numero=" + numero, {
                cache: "no-store", signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(10_000)]),
              });
              if (!acceso.ok) { detener("Tu acceso a esta sesión terminó. Vuelve al CRM para iniciar sesión."); return; }
            } catch { if (!detenido) detener("No se pudo volver a verificar tu acceso. Vuelve al CRM."); return; }
            if (detenido) return;
          }
          setVentana("Reconectando la ventana remota…");
          if (++reintentos > 3) { detener("La conexión remota se interrumpió. Puedes reintentar sin borrar el perfil."); return; }
          recarga = setTimeout(() => void abrir(), 3000);
        });
      } catch {
        if (!detenido) detener("No se pudo abrir el visor. Puedes reintentar sin borrar el perfil de WhatsApp.");
      }
    }
    void abrir().then(() => { if (!detenido) void consultarEstado(); });
    const actualizar = () => { if (!detenido && conectado) void consultarEstado(); };
    window.addEventListener("focus", actualizar);
    return () => {
      detenido = true; controlador.abort();
      clearTimeout(recarga); clearTimeout(consulta); clearTimeout(limiteConexion);
      window.removeEventListener("focus", actualizar);
      visor.current?.disconnect(); visor.current = null;
      contenedor?.replaceChildren();
    };
  }, [numero, temporal, intento]);

  function cambiarControl() {
    const siguiente = !modo.current;
    modo.current = siguiente; setSoloVer(siguiente);
    if (visor.current) visor.current.viewOnly = siguiente;
  }

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-sm font-semibold">WhatsApp remoto · +51 {numero}</h1>
          <p className="text-xs text-slate-300" aria-live="polite">{ventana} · {estado?.conectado ? "WhatsApp conectado" : estado?.mensaje}</p>
        </div>
        <button type="button" className="rounded border border-slate-500 px-3 py-2 text-sm" onClick={cambiarControl}>
          {soloVer ? "Activar control" : "Solo ver"}
        </button>
        <a href="/admin/whatsapp" className="text-sm underline">Volver al CRM</a>
      </header>
      <p className="px-4 py-2 text-xs text-slate-300">
        Escanea el QR desde WhatsApp → Dispositivos vinculados. Para observar una campaña, conserva el modo «Solo ver».
      </p>
      {error && <div className="flex items-center gap-3 bg-red-950 px-4 py-3" role="alert">
        <p className="text-sm">{error}</p>
        <button type="button" className="shrink-0 rounded border px-3 py-1 text-sm" onClick={() => setIntento((actual) => actual + 1)}>Reintentar</button>
      </div>}
      <div ref={pantalla} className="min-h-0 flex-1 overflow-hidden" aria-label="Ventana remota de WhatsApp Web" />
    </main>
  );
}
