/**
 * Formato compartido de los campos de texto enriquecido (cuerpo de noticia,
 * discurso de premios) — HTML producido por el editor de
 * components/admin/RichTextEditor.tsx, siempre saneado en el servidor antes de
 * guardarse (nunca se confía en el HTML que mande el cliente, aunque solo un admin
 * pueda enviarlo: ver el comentario de sanitizeRichText).
 *
 * Antes de este editor, estos campos eran texto plano (noticias: convención propia de
 * párrafo en blanco + guiones para listas, ver lib/newsBody.ts; discurso de premios:
 * un <p> a secas). `looksLikeHtml`/`plainTextToHtml` son el puente hacia atrás: cargan
 * ese texto plano ya existente dentro del editor nuevo como HTML real, sin necesitar
 * una migración de datos.
 */
import sanitizeHtml from "sanitize-html";

// Exactamente lo que la barra de herramientas del editor puede producir — nada de
// `<script>`, `<img>`, `class`/`id`, ni enlaces (no hay botón de enlace en la barra).
// `span` con `style="color: ..."` es para el selector de color de texto; `data-role-id`
// es el único `data-*` permitido, y solo para la "píldora" de mención de rol que
// inserta el desplegable de menciones (ver RichTextEditor.tsx e
// htmlToDiscordMarkdown más abajo) — un id de rol de Discord es siempre dígitos.
const ALLOWED_TAGS = ["h1", "h2", "p", "strong", "em", "s", "blockquote", "ul", "ol", "li", "br", "span"];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { span: ["style", "data-role-id"] },
    allowedStyles: { span: { color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/] } },
    disallowedTagsMode: "discard",
  });
}

export function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/** El editor (components/admin/RichTextEditor.tsx) nunca manda un string realmente
 * vacío — un documento "vacío" en Tiptap sigue siendo `<p></p>`, así que un simple
 * `!body` en el servidor nunca dispararía. Se comprueba quitando TODAS las etiquetas y
 * mirando si queda algo de texto real. */
export function isRichTextEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Párrafo en blanco -> `<p>`, salto de línea suelto -> `<br>` — mismo criterio que ya
 * usaba lib/newsBody.ts para leer texto plano, aplicado ahora a la inversa (texto
 * plano -> HTML) para que un artículo o discurso guardado ANTES de este editor se siga
 * viendo igual de bien la primera vez que se abre dentro de él. */
export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Contenido inicial listo para pasarle al editor: HTML tal cual si ya lo es, o
 * convertido desde texto plano si no. */
export function toEditorContent(text: string): string {
  return looksLikeHtml(text) ? text : plainTextToHtml(text);
}

function unescapeHtmlEntities(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** Negrita/cursiva/tachado a su sintaxis Markdown de Discord, saltos de línea sueltos
 * a `\n`, y el color de texto DESCARTADO — Discord no tiene ninguna sintaxis de color
 * en un mensaje normal (a diferencia de un bloque ```ansi```, que es otra cosa y no
 * encaja aquí), así que un `<span style="color:...">` se deshace y se queda solo con
 * el texto de dentro, nunca con la etiqueta suelta ni con el estilo colándose como
 * texto literal. Aplicado en bucle hasta que no cambia nada más, para negrita+cursiva
 * anidadas (el propio editor puede producir `<strong><em>texto</em></strong>`). */
function convertInlineMarksToDiscord(html: string): string {
  // Píldora de mención de rol (RichTextEditor.tsx, desplegable de menciones) -> el
  // token de verdad que Discord pinga (`<@&ID>`, ver
  // https://discord.com/developers/docs/reference#message-formatting). Pasada única
  // ANTES del bucle de abajo: una vez convertido no queda `<span>` que ese bucle
  // pueda tocar. Un `data-role-id` que no sea puramente numérico (nunca debería pasar,
  // pero el HTML nunca es de fiar) simplemente no machea y cae al strip genérico de
  // span de más abajo — ni ping ni marcado roto, solo el nombre en texto plano.
  let out = html.replace(/<span[^>]*data-role-id="(\d+)"[^>]*>[\s\S]*?<\/span>/gi, "<@&$1>");
  let previous: string;
  do {
    previous = out;
    out = out
      .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1")
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*")
      .replace(/<s>([\s\S]*?)<\/s>/gi, "~~$1~~")
      .replace(/<br\s*\/?>/gi, "\n");
  } while (out !== previous);
  return out;
}

/**
 * Traduce el HTML del editor (components/admin/RichTextEditor.tsx) al Markdown que
 * Discord sabe leer de verdad en un mensaje — pedido explícito del propietario:
 * "must be compatible with the discord messages too". `# `/`## ` para H1/H2 (Discord
 * SÍ soporta encabezados de verdad, ver lib/discordBot/commands/announce.ts), `> ` por
 * línea de cita, `- ` / `N. ` para listas — todo lo que la barra de herramientas puede
 * producir tiene un equivalente real en Discord, EXCEPTO el color, que se pierde a
 * propósito (ver convertInlineMarksToDiscord) en vez de dejar basura de HTML/CSS en el
 * mensaje. Pensado para cuando el discurso de premios (o una noticia) se publique en
 * Discord — hoy nada llama a esto todavía (esa tarea del bot no existe aún), es la
 * pieza reutilizable para cuando exista.
 */
export function htmlToDiscordMarkdown(html: string): string {
  const blockPattern = /<h1>([\s\S]*?)<\/h1>|<h2>([\s\S]*?)<\/h2>|<blockquote>([\s\S]*?)<\/blockquote>|<ul>([\s\S]*?)<\/ul>|<ol>([\s\S]*?)<\/ol>|<p>([\s\S]*?)<\/p>/gi;
  const blocks: string[] = [];

  for (const match of html.matchAll(blockPattern)) {
    const [, h1, h2, quote, ul, ol, p] = match;
    if (h1 !== undefined) {
      blocks.push(`# ${convertInlineMarksToDiscord(h1).trim()}`);
    } else if (h2 !== undefined) {
      blocks.push(`## ${convertInlineMarksToDiscord(h2).trim()}`);
    } else if (quote !== undefined) {
      const text = convertInlineMarksToDiscord(quote).trim();
      if (text) blocks.push(text.split("\n").map((line) => `> ${line}`).join("\n"));
    } else if (ul !== undefined) {
      const items = [...ul.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((li) => `- ${convertInlineMarksToDiscord(li[1]).trim()}`);
      if (items.length > 0) blocks.push(items.join("\n"));
    } else if (ol !== undefined) {
      const items = [...ol.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((li, i) => `${i + 1}. ${convertInlineMarksToDiscord(li[1]).trim()}`);
      if (items.length > 0) blocks.push(items.join("\n"));
    } else if (p !== undefined) {
      const text = convertInlineMarksToDiscord(p).trim();
      if (text) blocks.push(text);
    }
  }

  return unescapeHtmlEntities(blocks.join("\n\n"));
}
