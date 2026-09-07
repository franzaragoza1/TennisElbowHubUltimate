/**
 * Divide el cuerpo de una noticia (texto plano — el prompt de la IA dice "no
 * markdown", y un admin puede pegarlo a mano en un <textarea>, ver
 * components/admin/NewsForm.tsx) en bloques para pintar. Pedido explícito, "in
 * general news don't look good to read": unas notas de parche pegadas desde el foro
 * traían líneas "- Item" separadas por UN solo salto de línea, no una línea en blanco
 * — HTML colapsa saltos de línea sueltos a un espacio al pintar texto normal, así que
 * toda la lista se leía fundida en un único bloque de texto corrido en vez de una
 * lista (visto en real: news.id 44, "A big update is here!" — ver newsBody.test.ts,
 * que reproduce ese cuerpo exacto). Un párrafo cuyas líneas son TODAS un guion se
 * convierte en lista de verdad; cualquier otro conserva sus saltos de línea sueltos
 * (se pintan como <br/> en components/news/NewsBody.tsx, nunca se pierden).
 */
export type NewsBodyBlock = { type: "paragraph"; lines: string[] } | { type: "list"; items: string[] };

const BULLET_RE = /^[-•]\s+/;

/** Agrupa por RACHAS contiguas de líneas — no por párrafo entero — porque el caso
 * real (news.id 44) mezcla una línea de cabecera ("New Features :") seguida de varias
 * líneas "- Item" dentro del mismo párrafo (una sola línea en blanco entre bloques,
 * ninguna dentro): tratar el párrafo como un todo-o-nada nunca lo separaría bien.
 * Cualquier racha de 1+ líneas con guion se convierte en lista de verdad; el resto se
 * mantiene como párrafo con sus saltos de línea sueltos intactos. */
export function parseNewsBody(body: string): NewsBodyBlock[] {
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: NewsBodyBlock[] = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let i = 0;
    while (i < lines.length) {
      if (BULLET_RE.test(lines[i])) {
        const items: string[] = [];
        while (i < lines.length && BULLET_RE.test(lines[i])) {
          items.push(lines[i].replace(BULLET_RE, ""));
          i++;
        }
        blocks.push({ type: "list", items });
      } else {
        const plainLines: string[] = [];
        while (i < lines.length && !BULLET_RE.test(lines[i])) {
          plainLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: "paragraph", lines: plainLines });
      }
    }
  }
  return blocks;
}
