// components/HeaderPanelAdmin.tsx
// Encabezado reutilizable para cada sección del Panel Admin.
// consistencia visual entre Dashboard, Exportar, Portafolio, Usuarios.

export default function HeaderPanelAdmin({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <div
      className="mb-6 pb-4"
      style={{ borderBottom: "1px solid var(--color-borde)" }}
    >
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--color-marca)" }}
      >
        {titulo}
      </h1>
      <p className="text-sm mt-1" style={{ color: "var(--color-texto-suave)" }}>
        {descripcion}
      </p>
    </div>
  );
}
