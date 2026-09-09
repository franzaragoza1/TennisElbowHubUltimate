import { sanitizeRichText, toEditorContent } from "@/lib/richText";

/** El discurso del admin (components/admin/sections/AwardsSection.tsx), compartido
 * entre /awards y /awards/[period] — `toEditorContent` cubre un discurso guardado
 * antes del editor de texto enriquecido (texto plano, sin etiquetas), `sanitizeRichText`
 * es defensa en profundidad además del saneado ya aplicado al guardar
 * (app/admin/awards/actions.ts::updateAwardPeriodSpeech). */
export function SpeechBlock({ speech }: { speech: string }) {
  return (
    <div
      className="rich-text mb-8 rounded-lg border border-rule bg-paper-tint px-4 py-3 text-sm text-ink"
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(toEditorContent(speech)) }}
    />
  );
}
