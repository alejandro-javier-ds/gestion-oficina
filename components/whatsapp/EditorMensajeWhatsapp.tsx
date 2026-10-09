// components/whatsapp/EditorMensajeWhatsapp.tsx
// Editor de la plantilla de mensaje de WhatsApp.
// Carga automáticamente la plantilla de la campaña.
// Permite editarla y restaurar el texto original.
// No realiza envíos.

"use client";

import { RotateCcw, MessageSquareText } from "lucide-react";

type Props = {
  campaña: string;
  mensaje: string;
  plantillaOriginal: string;
  onChange: (mensaje: string) => void;
  onRestaurar: () => void;
};

export default function EditorMensajeWhatsapp({
  campaña,
  mensaje,
  plantillaOriginal,
  onChange,
  onRestaurar,
}: Props) {
  const caracteres = mensaje.length;

  const modificado = mensaje !== plantillaOriginal;

  return (
    <section className="tarjeta overflow-hidden">
      <div
        className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
        style={{
          borderColor: "var(--color-borde)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="whatsapp-icono shrink-0">
            <MessageSquareText size={18} />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold">Mensaje</h2>

            <p
              className="mt-1 text-xs sm:text-sm"
              style={{
                color: "var(--color-texto-suave)",
              }}
            >
              Plantilla de la campaña:{" "}
              <span className="font-medium">{campaña}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {modificado && <span className="chip chip-alerta">Editado</span>}

          <button
            type="button"
            className="boton-secundario inline-flex items-center gap-2"
            onClick={onRestaurar}
            disabled={!modificado}
          >
            <RotateCcw size={14} />
            Restaurar plantilla
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <textarea
          value={mensaje}
          onChange={(event) => onChange(event.target.value)}
          rows={8}
          className="input-estandar w-full resize-y"
          placeholder="Escribe el mensaje..."
          spellCheck
        />

        <div className="mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p
            style={{
              color: "var(--color-texto-suave)",
            }}
          >
            El mensaje se puede editar antes de preparar la campaña.
          </p>

          <p
            className="dato-numerico"
            style={{
              color:
                caracteres > 1000
                  ? "var(--color-error)"
                  : "var(--color-texto-suave)",
            }}
          >
            {caracteres} caracteres
          </p>
        </div>
      </div>
    </section>
  );
}
