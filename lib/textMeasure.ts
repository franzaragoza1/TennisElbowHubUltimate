/**
 * Ancho real (en px) que ocuparía un texto con esas clases de Tailwind — medido con
 * un nodo de verdad fuera de pantalla, nunca aproximado por nº de caracteres (sale
 * mal con mayúsculas, negrita o dígitos: "OOGABOOGA2808" no pesa lo mismo por letra
 * que "gyrmik"). El nodo cuelga del propio `document.body`, así que hereda la MISMA
 * hoja de estilos y la MISMA fuente que el resto de la página — no hay que adivinar
 * ninguna cadena de `font-family`/peso a mano.
 *
 * Solo funciona en el navegador; en el servidor (o antes de hidratar) devuelve 0 sin
 * más. En la práctica solo lo llama `BracketColumns`, un Client Component, así que
 * nunca se invoca en el servidor de verdad.
 */
let measurer: HTMLSpanElement | null = null;
const cache = new Map<string, number>();

function getMeasurer(): HTMLSpanElement {
  if (measurer) return measurer;
  const el = document.createElement("span");
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  el.style.whiteSpace = "nowrap";
  el.style.pointerEvents = "none";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  document.body.appendChild(el);
  measurer = el;
  return el;
}

export function measureText(text: string, className: string): number {
  if (typeof document === "undefined" || !text) return 0;
  const key = `${className}::${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const el = getMeasurer();
  el.className = className;
  el.textContent = text;
  const width = el.getBoundingClientRect().width;
  cache.set(key, width);
  return width;
}
