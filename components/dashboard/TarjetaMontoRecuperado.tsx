// components/dashboard/TarjetaMontoRecuperado.tsx
// Tarjeta KPI de monto recuperado del mes.

type Props = {
  monto: number;
  montoDolares: number;
};

function formatearMoneda(valor: number, simbolo: string): string {
  return `${simbolo} ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TarjetaMontoRecuperado({ monto, montoDolares }: Props) {
  return (
    <div className="tarjeta p-4 sm:p-5">
      <p
        className="text-xs uppercase tracking-wide font-medium"
        style={{ color: "var(--color-texto-suave)" }}
      >
        Monto recuperado del mes
      </p>
      {[
        { simbolo: "S/", valor: monto },
        { simbolo: "US$", valor: montoDolares },
      ].map(({ simbolo, valor }) => (
        <p
          key={simbolo}
          className="mt-1 font-bold dato-numerico"
          style={{
            fontSize: "clamp(1.5rem, 4vw, var(--texto-3xl))",
            color: valor > 0 ? "var(--color-exito)" : "var(--color-texto)",
          }}
        >
          {formatearMoneda(valor, simbolo)}
        </p>
      ))}
      <p className="text-xs mt-1" style={{ color: "var(--color-texto-tenue)" }}>
        Suma de &quot;Monto Pagado&quot; en gestiones del periodo
      </p>
    </div>
  );
}
