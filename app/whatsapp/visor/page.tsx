import { redirect } from "next/navigation";
import { leerSesionActual } from "@/lib/auth";
import VisorWhatsapp from "@/components/whatsapp/VisorWhatsapp";

export default async function PaginaVisorWhatsapp({ searchParams }: {
  searchParams: Promise<{ numero?: string; temporal?: string }>;
}) {
  const sesion = await leerSesionActual();
  if (!sesion) redirect("/login");
  if (sesion.debeCambiarContrasena) redirect("/cambiar-contrasena");
  if (sesion.rol !== "administrador" && sesion.rol !== "supervisor") {
    return <p className="p-6" role="alert">No tienes permiso para abrir esta ventana.</p>;
  }
  const parametros = await searchParams;
  if (!/^9\d{8}$/.test(parametros.numero ?? "")) return <p className="p-6" role="alert">Selecciona un número válido desde el CRM.</p>;
  return <VisorWhatsapp numero={parametros.numero!} temporal={parametros.temporal === "1"} />;
}
