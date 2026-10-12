// proxy.ts
//// proxy.ts
// Protección central de páginas y APIs.
//
// Comportamiento:
// - Las páginas sin sesión -> /login.
// - Las APIs sin sesión -> JSON 401.
// - Las páginas con rol incorrecto -> redirección.
// - Las APIs con rol incorrecto -> JSON 403.
// - Renueva la sesión válida por 20 minutos.
// - Mantiene las reglas de cambio de contraseña.
// - Mantiene la protección de /admin y /admin/usuarios.

import { NextRequest, NextResponse } from "next/server";

import {
  crearSesion,
  verificarSesionToken,
  NOMBRE_COOKIE,
  CABECERA_SESION_VERIFICADA,
  DURACION_SESION_MINUTOS,
} from "@/lib/auth";

const RUTAS_PUBLICAS = ["/login", "/api/login"];

const RUTA_CAMBIO_CONTRASENA_PAGINA = "/cambiar-contrasena";

const RUTAS_CAMBIO_CONTRASENA = [
  RUTA_CAMBIO_CONTRASENA_PAGINA,
  "/api/cambiar-contrasena",
  "/api/logout",
];

const ROLES_CON_PANEL_ADMIN = ["administrador", "supervisor", "abogado"];

function destinoPorRol(rol: string): string {
  if (rol === "administrador" || rol === "abogado") {
    return "/admin";
  }

  if (rol === "supervisor") {
    return "/elegir-modo";
  }

  return "/";
}

function esApi(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function respuestaApiNoAutenticado() {
  const respuesta = NextResponse.json(
    {
      error: "No autenticado.",
    },
    {
      status: 401,
    },
  );
  respuesta.headers.set("Cache-Control", "private, no-store, max-age=0");
  return respuesta;
}

function respuestaApiSinPermiso() {
  const respuesta = NextResponse.json(
    {
      error: "No tienes permiso para acceder a este recurso.",
    },
    {
      status: 403,
    },
  );
  respuesta.headers.set("Cache-Control", "private, no-store, max-age=0");
  return respuesta;
}

function respuestaSinSesion(request: NextRequest) {
  const respuesta = esApi(request.nextUrl.pathname)
    ? respuestaApiNoAutenticado()
    : NextResponse.redirect(new URL("/login", request.url));
  respuesta.cookies.delete(NOMBRE_COOKIE);
  return respuesta;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const peticionApi = esApi(pathname);
  const encabezadosSolicitud = new Headers(request.headers);
  encabezadosSolicitud.delete(CABECERA_SESION_VERIFICADA);

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) =>
    pathname.startsWith(ruta),
  );

  if (esRutaPublica) {
    const respuesta = NextResponse.next({
      request: { headers: encabezadosSolicitud },
    });
    if (peticionApi) {
      respuesta.headers.set("Cache-Control", "private, no-store, max-age=0");
    }
    return respuesta;
  }

  const token = request.cookies.get(NOMBRE_COOKIE)?.value;

  if (!token) return respuestaSinSesion(request);

  try {
    const sesion = await verificarSesionToken(token);
    if (!sesion) return respuestaSinSesion(request);

    const rol = sesion.rol;

    const esRutaDeCambioContrasena = RUTAS_CAMBIO_CONTRASENA.some((ruta) =>
      pathname.startsWith(ruta),
    );

    if (sesion.debeCambiarContrasena && !esRutaDeCambioContrasena) {
      if (peticionApi) {
        return NextResponse.json(
          {
            error: "Debes cambiar tu contraseña antes de continuar.",
            codigo: "CAMBIO_CONTRASENA_REQUERIDO",
          },
          {
            status: 403,
            headers: { "Cache-Control": "private, no-store, max-age=0" },
          },
        );
      }

      return NextResponse.redirect(new URL("/cambiar-contrasena", request.url));
    }

    if (
      !sesion.debeCambiarContrasena &&
      pathname.startsWith(RUTA_CAMBIO_CONTRASENA_PAGINA)
    ) {
      return NextResponse.redirect(new URL(destinoPorRol(rol), request.url));
    }

    const esRutaUsuarios =
      pathname.startsWith("/admin/usuarios") ||
      pathname.startsWith("/api/admin/usuarios");

    if (esRutaUsuarios && rol !== "administrador") {
      if (peticionApi) {
        return respuestaApiSinPermiso();
      }

      return NextResponse.redirect(new URL("/admin", request.url));
    }

    const esRutaAdmin =
      pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

    if (esRutaAdmin && !ROLES_CON_PANEL_ADMIN.includes(rol)) {
      if (peticionApi) {
        return respuestaApiSinPermiso();
      }

      return NextResponse.redirect(new URL("/", request.url));
    }

    const tokenRenovado = await crearSesion(sesion);

    encabezadosSolicitud.set(CABECERA_SESION_VERIFICADA, tokenRenovado);

    const respuesta = NextResponse.next({
      request: { headers: encabezadosSolicitud },
    });

    if (peticionApi) {
      respuesta.headers.set("Cache-Control", "private, no-store, max-age=0");
    }

    respuesta.cookies.set(NOMBRE_COOKIE, tokenRenovado, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: DURACION_SESION_MINUTOS * 60,
      path: "/",
    });

    return respuesta;
  } catch {
    return respuestaSinSesion(request);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|img/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
