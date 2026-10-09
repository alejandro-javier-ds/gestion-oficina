// components/dashboard/GaugeCircular.tsx
// Gauge circular — Intensidad y Cobertura.
// El arco usa una trayectoria semicircular fija y strokeDasharray para
// evitar deformaciones al cambiar el porcentaje.

type Props = {
  titulo: string;
  valor: number;
  meta: number;
  sufijo?: string;
  decimales?: number;
};

function colorPorTramo(porcentaje: number): {
  color: string;
  etiqueta: string;
} {
  if (porcentaje < 0.5)
    return { color: "var(--color-error)", etiqueta: "Bajo" };
  if (porcentaje < 0.8)
    return { color: "var(--color-alerta)", etiqueta: "En camino" };
  return { color: "var(--color-exito)", etiqueta: "Meta alcanzada" };
}

export default function GaugeCircular({
  titulo,
  valor,
  meta,
  sufijo = "",
  decimales = 1,
}: Props) {
  const esCobertura = sufijo === "%";

  const porcentajeArco = esCobertura
    ? Math.min(Math.max(valor / 100, 0), 1)
    : Math.min(Math.max(meta > 0 ? valor / meta : 0, 0), 1);

  const porcentajeMeta = meta > 0 ? Math.max(valor / meta, 0) : 0;
  const { color: colorActivo, etiqueta: etiquetaEstado } =
    colorPorTramo(porcentajeMeta);
  const alcanzaMeta = valor >= meta;

  const radio = 70;
  const cx = 100;
  const cy = 100;

  const longitudArco = Math.PI * radio;

  const d = `M ${cx - radio} ${cy} A ${radio} ${radio} 0 0 1 ${cx + radio} ${cy}`;

  const longitudProgreso = longitudArco * porcentajeArco;
  const dasharray = `${longitudProgreso} ${longitudArco}`;

  return (
    <div className="tarjeta p-4 sm:p-5 flex flex-col items-center">
      <p
        className="text-xs uppercase tracking-wide font-medium self-start"
        style={{ color: "var(--color-texto-suave)" }}
      >
        {titulo}
      </p>

      <svg
        viewBox="0 0 200 120"
        className="w-full max-w-[220px] mt-2"
        aria-label={`${titulo}: ${valor}${sufijo}`}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--color-fondo-sutil)"
          strokeWidth={14}
          strokeLinecap="round"
        />

        {porcentajeArco > 0 && (
          <path
            d={d}
            fill="none"
            stroke={colorActivo}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={dasharray}
            strokeDashoffset={0}
            style={{
              transition: "stroke-dasharray 0.25s ease, stroke 0.2s ease",
            }}
          />
        )}

        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          className="dato-numerico"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            fill: "var(--color-texto)",
          }}
        >
          {valor.toFixed(decimales)}
          {sufijo}
        </text>

        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          style={{
            fontSize: "11px",
            fill: "var(--color-texto-suave)",
          }}
        >
          {esCobertura
            ? "de 100% de cartera"
            : `de ${meta.toFixed(decimales)}${sufijo} de meta`}
        </text>
      </svg>

      <p className="text-xs mt-1 font-medium" style={{ color: colorActivo }}>
        {alcanzaMeta
          ? "Meta alcanzada"
          : `${etiquetaEstado} · Falta ${(meta - valor).toFixed(esCobertura ? 1 : decimales)}${sufijo}`}
      </p>
    </div>
  );
}
