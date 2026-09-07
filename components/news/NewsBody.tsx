import { Fragment } from "react";
import { parseNewsBody } from "@/lib/newsBody";
import { LinkifiedText } from "@/components/LinkifiedText";

/** Pinta el cuerpo de una noticia ya dividido en bloques (lib/newsBody.ts) — un
 * párrafo conserva sus saltos de línea sueltos como <br/> en vez de dejar que HTML
 * los colapse a un espacio, y una racha de líneas "- Item" se pinta como una lista de
 * verdad. Server Component, sin interactividad. */
export function NewsBody({ body }: { body: string }) {
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
