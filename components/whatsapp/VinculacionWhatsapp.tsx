"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { EstadoSesionWhatsapp } from "@/lib/whatsapp/playwright";

type Props = { numero: string; onEstado: (estado: EstadoSesionWhatsapp) => void };

export default function VinculacionWhatsapp({ numero, onEstado }: Props) {
  const [imagen, setImagen] = useState<{ numero: string; qr: string | null; error: string }>({ numero: "", qr: null, error: "" });

  useEffect(() => {
    let detenido = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const controlador = new AbortController();

    async function consultar() {
      let demora = 3000;
      try {
        const respuesta = await fetch(`/api/whatsapp/playwright/qr?numero=${encodeURIComponent(numero)}`, {
          cache: "no-store", signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(10_000)]),
        });
        const datos = await respuesta.json() as EstadoSesionWhatsapp & { qr?: string | null; error?: string };
        if (detenido) return;
        if (!respuesta.ok) {
          setImagen({ numero, qr: null, error: datos.error ?? "No se pudo consultar el código QR." });
          if (respuesta.status === 401 || respuesta.status === 403) { detenido = true; return; }
          return;
        }
        if (datos.numero !== numero) throw new Error("Respuesta de vinculación inválida.");
        const qr = datos.qrVisible && !datos.conectado && typeof datos.qr === "string" &&
          datos.qr.length <= 256_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(datos.qr) ? datos.qr : null;
        setImagen({ numero, qr, error: "" });
        onEstado({
          numero: datos.numero, iniciado: datos.iniciado, conectado: datos.conectado, qrVisible: datos.qrVisible,
          paginaAbierta: datos.paginaAbierta, temporal: datos.temporal, estado: datos.estado, mensaje: datos.mensaje,
        });
        if (datos.conectado || !datos.iniciado || document.hidden) demora = 10_000;
      } catch {
        if (!detenido) setImagen({ numero, qr: null, error: "No se pudo actualizar la vinculación. Se volverá a intentar." });
      } finally {
        if (!detenido) temporizador = setTimeout(() => void consultar(), demora);
      }
    }

    void consultar();
    return () => {
      detenido = true;
      controlador.abort();
      clearTimeout(temporizador);
    };
  }, [numero, onEstado]);

  if (imagen.numero !== numero) return null;
  return (
    <div aria-live="polite">
      {imagen.qr && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="rounded-lg bg-white p-3">
            <Image src={imagen.qr} alt="Código QR para vincular WhatsApp" width={264} height={264} unoptimized className="h-auto max-w-full" />
          </div>
          <p className="text-center text-xs" style={{ color: "var(--color-texto-suave)" }}>
            En tu celular, abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo.
          </p>
        </div>
      )}
      {imagen.error && <p className="mt-3 text-xs" role="alert" style={{ color: "var(--color-alerta)" }}>{imagen.error}</p>}
    </div>
  );
}
