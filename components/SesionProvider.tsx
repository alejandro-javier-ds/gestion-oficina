"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SesionCliente = {
  userId: number;
  nombreCompleto: string;
  rol: "administrador" | "supervisor" | "abogado" | "gestor";
};

type SesionContexto = {
  sesion: SesionCliente | null;
  cargando: boolean;
  cargar: () => void;
  invalidar: () => void;
};

const ContextoSesion = createContext<SesionContexto | null>(null);

export default function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionCliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const cargada = useRef(false);
  const solicitud = useRef<Promise<void> | null>(null);
  const version = useRef(0);

  const cargar = useCallback(() => {
    if (cargada.current || solicitud.current) return;

    const versionActual = version.current;
    setCargando(true);

    const pendiente = (async () => {
      try {
        const respuesta = await fetch("/api/sesion", { cache: "no-store" });
        if (!respuesta.ok) throw new Error("No se pudo validar la sesión.");

        const datos = (await respuesta.json()) as {
          sesion?: SesionCliente | null;
        };

        if (version.current === versionActual) {
          setSesion(datos.sesion ?? null);
        }
      } catch {
        if (version.current === versionActual) setSesion(null);
      } finally {
        if (version.current === versionActual) {
          cargada.current = true;
          solicitud.current = null;
          setCargando(false);
        }
      }
    })();

    solicitud.current = pendiente;
  }, []);

  const invalidar = useCallback(() => {
    version.current += 1;
    cargada.current = false;
    solicitud.current = null;
    setSesion(null);
    setCargando(true);
  }, []);

  const valor = useMemo(
    () => ({ sesion, cargando, cargar, invalidar }),
    [sesion, cargando, cargar, invalidar],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) throw new Error("useSesion requiere SesionProvider.");
  const { cargar } = contexto;

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { sesion: contexto.sesion, cargando: contexto.cargando };
}

export function useInvalidarSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) throw new Error("useInvalidarSesion requiere SesionProvider.");
  return contexto.invalidar;
}
