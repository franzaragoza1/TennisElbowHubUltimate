/**
 * Partido puro texto → segmentos texto/enlace — sin JSX aquí a propósito, así se
 * testea sin montar nada (ver components/LinkifiedText.tsx para el render real).
 * Pedido explícito: "In the news, links in the text must be clickable" — el cuerpo de
 * una noticia es texto plano (el propio prompt de la IA dice "no markdown", y el admin
 * la escribe a mano en un <textarea>), así que una URL suelta como
 * "https://www.managames.com/Forum/..." nunca llega con sintaxis de enlace, solo como
 * texto — esto la detecta por patrón en vez de exigir que alguien la marque a mano.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

export interface LinkifySegment {
  text: string;
  href: string | null;
}

/** Puntuación de cierre de frase casi segura al final de la URL detectada (un punto,
 * una coma, un paréntesis de cierre...) — se separa como texto normal después del
 * enlace, para no colar "https://…Forum/." como si el punto fuera parte de la URL. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

export function splitLinkifiable(text: string): LinkifySegment[] {
  const segments: LinkifySegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    if (trailing) url = url.slice(0, -trailing.length);
    if (url.length === 0) continue; // toda la coincidencia era puntuación (no debería pasar, pero por si acaso)

    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start), href: null });
    segments.push({ text: url, href: url });
    if (trailing) segments.push({ text: trailing, href: null });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), href: null });
  return segments;
}
