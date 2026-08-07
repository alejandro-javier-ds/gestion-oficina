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

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  SignJWT,
  jwtVerify,
} from 'jose';

const CLAVE_SECRETA =
  new TextEncoder().encode(
    process.env.JWT_SECRET,
  );

const NOMBRE_COOKIE =
  'sesion_gestion_oficina';

const DURACION_SESION_MINUTOS =
  20;

const RUTAS_PUBLICAS = [
  '/login',
  '/api/login',
];

const RUTA_CAMBIO_CONTRASENA_PAGINA =
  '/cambiar-contrasena';

const RUTAS_CAMBIO_CONTRASENA = [
  RUTA_CAMBIO_CONTRASENA_PAGINA,
  '/api/cambiar-contrasena',
  '/api/logout',
];

const ROLES_CON_PANEL_ADMIN = [
  'administrador',
  'supervisor',
  'abogado',
];

function destinoPorRol(
  rol: string,
): string {
  if (
    rol === 'administrador' ||
    rol === 'abogado'
  ) {
    return '/admin';
  }

  if (
    rol === 'supervisor'
  ) {
    return '/elegir-modo';
  }

  return '/';
}

/**
 * Determina si la petición corresponde
 * a una API.
 */
function esApi(
  pathname: string,
): boolean {
  return pathname.startsWith(
    '/api/',
  );
}

/**
 * Respuesta uniforme para APIs sin autenticación.
 */
function respuestaApiNoAutenticado() {
  return NextResponse.json(
    {
      error:
        'No autenticado.',
    },
    {
      status: 401,
    },
  );
}

/**
 * Respuesta uniforme para APIs sin permisos.
 */
function respuestaApiSinPermiso() {
  return NextResponse.json(
    {
      error:
        'No tienes permiso para acceder a este recurso.',
    },
    {
      status: 403,
    },
  );
}

export async function proxy(
  request: NextRequest,
) {
  const {
    pathname,
  } = request.nextUrl;

  const peticionApi =
    esApi(pathname);

  /*
   * ----------------------------------------------------------
   * RUTAS PÚBLICAS
   * ----------------------------------------------------------
   */

  const esRutaPublica =
    RUTAS_PUBLICAS.some(
      (ruta) =>
        pathname.startsWith(
          ruta,
        ),
    );

  if (esRutaPublica) {
    return NextResponse.next();
  }

  /*
   * ----------------------------------------------------------
   * SESIÓN
   * ----------------------------------------------------------
   */

  const token =
    request.cookies.get(
      NOMBRE_COOKIE,
    )?.value;

  /*
   * Si no existe sesión:
   *
   * página -> /login
   * API    -> JSON 401
   *
   * ESTE ES EL CAMBIO IMPORTANTE.
   */
  if (!token) {
    if (peticionApi) {
      return respuestaApiNoAutenticado();
    }

    return NextResponse.redirect(
      new URL(
        '/login',
        request.url,
      ),
    );
  }

  try {
    /*
     * --------------------------------------------------------
     * VALIDAR JWT
     * --------------------------------------------------------
     */

    const {
      payload,
    } =
      await jwtVerify(
        token,
        CLAVE_SECRETA,
      );

    const rol =
      payload.rol as string;

    /*
     * --------------------------------------------------------
     * CAMBIO DE CONTRASEÑA
     * --------------------------------------------------------
     */

    const esRutaDeCambioContrasena =
      RUTAS_CAMBIO_CONTRASENA.some(
        (ruta) =>
          pathname.startsWith(
            ruta,
          ),
      );

    if (
      payload.debeCambiarContrasena &&
      !esRutaDeCambioContrasena
    ) {
      /*
       * API:
       * no redirigimos a una página HTML.
       */
      if (peticionApi) {
        return NextResponse.json(
          {
            error:
              'Debes cambiar tu contraseña antes de continuar.',
            codigo:
              'CAMBIO_CONTRASENA_REQUERIDO',
          },
          {
            status: 403,
          },
        );
      }

      return NextResponse.redirect(
        new URL(
          '/cambiar-contrasena',
          request.url,
        ),
      );
    }

    if (
      !payload.debeCambiarContrasena &&
      pathname.startsWith(
        RUTA_CAMBIO_CONTRASENA_PAGINA,
      )
    ) {
      return NextResponse.redirect(
        new URL(
          destinoPorRol(
            rol,
          ),
          request.url,
        ),
      );
    }

    /*
     * --------------------------------------------------------
     * ADMINISTRADORES
     * --------------------------------------------------------
     */

    const esRutaUsuarios =
      pathname.startsWith(
        '/admin/usuarios',
      ) ||
      pathname.startsWith(
        '/api/admin/usuarios',
      );

    if (
      esRutaUsuarios &&
      rol !==
        'administrador'
    ) {
      if (peticionApi) {
        return respuestaApiSinPermiso();
      }

      return NextResponse.redirect(
        new URL(
          '/admin',
          request.url,
        ),
      );
    }

    /*
     * --------------------------------------------------------
     * PANEL ADMIN
     * --------------------------------------------------------
     */

    const esRutaAdmin =
      pathname.startsWith(
        '/admin',
      ) ||
      pathname.startsWith(
        '/api/admin',
      );

    if (
      esRutaAdmin &&
      !ROLES_CON_PANEL_ADMIN.includes(
        rol,
      )
    ) {
      if (peticionApi) {
        return respuestaApiSinPermiso();
      }

      return NextResponse.redirect(
        new URL(
          '/',
          request.url,
        ),
      );
    }

    /*
     * --------------------------------------------------------
     * RENOVACIÓN DE SESIÓN
     * --------------------------------------------------------
     */

    const tokenRenovado =
      await new SignJWT({
        ...payload,
      })
        .setProtectedHeader({
          alg: 'HS256',
        })
        .setIssuedAt()
        .setExpirationTime(
          `${DURACION_SESION_MINUTOS}m`,
        )
        .sign(
          CLAVE_SECRETA,
        );

    const respuesta =
      NextResponse.next();

    respuesta.cookies.set(
      NOMBRE_COOKIE,
      tokenRenovado,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          'production',
        sameSite: 'lax',
        maxAge:
          DURACION_SESION_MINUTOS *
          60,
        path: '/',
      },
    );

    return respuesta;
  } catch {
    /*
     * JWT inválido o expirado.
     *
     * Página -> /login
     * API    -> JSON 401
     */
    if (peticionApi) {
      return respuestaApiNoAutenticado();
    }

    return NextResponse.redirect(
      new URL(
        '/login',
        request.url,
      ),
    );
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|img/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)',
  ],
};