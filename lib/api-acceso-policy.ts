import type { DatosSesion, Rol } from "@/lib/auth";

export function evaluarAccesoApi(
  sesion: DatosSesion | null,
  roles: readonly Rol[],
): { status: number; error: string } | null {
  if (!sesion) return { status: 401, error: "No autenticado." };
  if (sesion.debeCambiarContrasena) {
    return { status: 403, error: "Debes cambiar tu contraseña antes de continuar." };
  }
  if (!roles.includes(sesion.rol)) {
    return { status: 403, error: "No tienes permiso para acceder a este recurso." };
  }
  return null;
}
