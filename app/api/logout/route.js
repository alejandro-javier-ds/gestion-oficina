// app/api/logout/route.ts
// Borra la cookie de sesión, cerrando la sesión actual.

import { NextResponse } from "next/server";
import { borrarCookieSesion } from "@/lib/auth";

export async function POST() {
  await borrarCookieSesion();
  return NextResponse.json({ ok: true });
}
