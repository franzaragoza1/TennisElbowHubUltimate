import { Fragment } from "react";
import { parseNewsBody } from "@/lib/newsBody";
import { looksLikeHtml, sanitizeRichText } from "@/lib/richText";
import { LinkifiedText } from "@/components/LinkifiedText";

/** Pinta el cuerpo de una noticia. Dos formatos conviven a propósito, sin migración de
 * datos: un artículo guardado con el editor de texto enriquecido
 * (components/admin/RichTextEditor.tsx) trae HTML de verdad y se pinta tal cual
 * (saneado otra vez aquí, defensa en profundidad — nunca se confía en una sola pasada);
 * un artículo de antes de ese editor (o un borrador generado por IA sin tocar todavía,
 * ver lib/newsGeneration/draft.ts) sigue siendo texto plano con la convención propia de
 * lib/newsBody.ts (párrafo en blanco, "- Item" para listas), y se sigue leyendo igual
 * que siempre. Server Component, sin interactividad. */
export function NewsBody({ body }: { body: string }) {
  if (looksLikeHtml(body)) {
    return <div className="rich-text text-[17px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }} />;
  }

  const blocks = parseNewsBody(body);

  return (
    <div className="space-y-4 text-[17px] leading-relaxed text-ink">
      {blocks.map((block, i) =>
        block.type === "list" ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <LinkifiedText text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <LinkifiedText text={line} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
