import { conTransaccion, consultarUno, ejecutar } from "@/lib/postgres";
import { verificarContrasena, type DatosSesion, type Rol } from "@/lib/auth";

export const INTENTOS_MAXIMOS = 5;
export const MINUTOS_BLOQUEO = 30;

type UsuarioLogin = {
  id: number;
  username: string;
  password_hash: string;
  nombre_completo: string;
  gestor: string | null;
  rol: Rol;
  debe_cambiar_contrasena: number;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
};

export type ResultadoLogin =
  | { tipo: "incorrecto"; intentosRestantes?: number }
  | { tipo: "bloqueado"; minutos: number; nuevo: boolean }
  | { tipo: "autenticado"; sesion: DatosSesion };

export async function autenticarUsuario(
  username: string,
  contrasena: string,
): Promise<ResultadoLogin> {
  return conTransaccion(async () => {
    const usuario = await consultarUno<UsuarioLogin>(
      "SELECT id::int AS id, username, password_hash, nombre_completo, gestor, " +
      "rol, debe_cambiar_contrasena, intentos_fallidos, bloqueado_hasta " +
      "FROM usuarios WHERE username = $1 AND activo = 1 FOR UPDATE",
      [username],
    );

    if (!usuario) return { tipo: "incorrecto" };

    const ahora = Date.now();
    const finBloqueo = usuario.bloqueado_hasta
      ? new Date(usuario.bloqueado_hasta).getTime()
      : 0;

    if (finBloqueo > ahora) {
      return {
        tipo: "bloqueado",
        minutos: Math.max(1, Math.ceil((finBloqueo - ahora) / 60_000)),
        nuevo: false,
      };
    }

    const valida = await verificarContrasena(contrasena, usuario.password_hash);

    if (!valida) {
      const intentosPrevios = usuario.bloqueado_hasta
        ? 0
        : usuario.intentos_fallidos;
      const intentos = intentosPrevios + 1;

      if (intentos >= INTENTOS_MAXIMOS) {
        const hasta = new Date(
          Date.now() + MINUTOS_BLOQUEO * 60_000,
        ).toISOString();
        await ejecutar(
          "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = $1 WHERE id = $2",
          [hasta, usuario.id],
        );
        return { tipo: "bloqueado", minutos: MINUTOS_BLOQUEO, nuevo: true };
      }

      await ejecutar(
        "UPDATE usuarios SET intentos_fallidos = $1, bloqueado_hasta = NULL WHERE id = $2",
        [intentos, usuario.id],
      );
      return {
        tipo: "incorrecto",
        intentosRestantes: INTENTOS_MAXIMOS - intentos,
      };
    }

    await ejecutar(
      "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1",
      [usuario.id],
    );

    return {
      tipo: "autenticado",
      sesion: {
        userId: usuario.id,
        username: usuario.username,
        nombreCompleto: usuario.nombre_completo,
        gestor: usuario.gestor,
        rol: usuario.rol,
        debeCambiarContrasena: usuario.debe_cambiar_contrasena === 1,
      },
    };
  });
}
