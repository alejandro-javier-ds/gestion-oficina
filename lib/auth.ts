// lib/auth.ts
// Funciones centrales de autenticación
// contraseñas, y crear/leer la cookie de sesión firmada.

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "Falta la variable de entorno JWT_SECRET. Revisa que exista el archivo .env.local en la raíz del proyecto.",
  );
}

const CLAVE_SECRETA = new TextEncoder().encode(process.env.JWT_SECRET);

const NOMBRE_COOKIE = "sesion_gestion_oficina";
const DURACION_SESION_MINUTOS = 20;

export type Rol = "administrador" | "supervisor" | "abogado" | "gestor";

export const ROLES_CON_PANEL_ADMIN: Rol[] = [
  "administrador",
  "supervisor",
  "abogado",
];

export type DatosSesion = {
  userId: number;
  username: string;
  nombreCompleto: string;
  gestor: string | null;
  rol: Rol;
  debeCambiarContrasena: boolean;
};

export async function cifrarContrasena(
  contrasenaPlana: string,
): Promise<string> {
  const rondas = 10;
  return bcrypt.hash(contrasenaPlana, rondas);
}

export async function verificarContrasena(
  contrasenaPlana: string,
  hashGuardado: string,
): Promise<boolean> {
  return bcrypt.compare(contrasenaPlana, hashGuardado);
}

export async function crearSesion(datos: DatosSesion): Promise<string> {
  const token = await new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_MINUTOS}m`)
    .sign(CLAVE_SECRETA);

  return token;
}

export async function guardarCookieSesion(token: string) {
  const almacenCookies = await cookies();
  almacenCookies.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DURACION_SESION_MINUTOS * 60,
    path: "/",
  });
}

export async function borrarCookieSesion() {
  const almacenCookies = await cookies();
  almacenCookies.delete(NOMBRE_COOKIE);
}

export async function leerSesionActual(): Promise<DatosSesion | null> {
  const almacenCookies = await cookies();
  const token = almacenCookies.get(NOMBRE_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, CLAVE_SECRETA);
    return payload as unknown as DatosSesion;
  } catch {
    return null;
  }
}
