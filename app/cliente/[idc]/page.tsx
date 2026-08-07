// app/cliente/[idc]/page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import FichaCliente from "@/components/FichaCliente";

export default function ClientePageDirecta() {
  const params = useParams();
  const router = useRouter();
  const idc = params.idc as string;

  return (
    <main
      className="tema-gestor min-h-screen"
      style={{ background: "var(--color-fondo)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
        <button
          onClick={() => router.push("/")}
          className="text-sm mb-1 font-medium"
          style={{ color: "var(--color-accion)" }}
        >
          ← Volver a la búsqueda
        </button>
      </div>
      <FichaCliente idc={idc} />
    </main>
  );
}
