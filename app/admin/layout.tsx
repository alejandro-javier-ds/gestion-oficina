// app/admin/layout.tsx
//
// Layout compartido para todo lo que vive bajo /admin.
// Sidebar a la izquierda, contenido responsive a la derecha.

import SidebarAdmin from "@/components/SidebarAdmin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen w-full"
      style={{
        background: "var(--color-fondo)",
      }}
    >
      <SidebarAdmin />

      <main className="min-w-0 flex-1 overflow-x-auto">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
