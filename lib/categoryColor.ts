/**
 * Color del embed de Discord al anunciar un torneo nuevo
 * (lib/discordBot/commands/newTournament.ts) — un embed es una franja sólida sin
 * texto encima, así que no le hace falta la misma paleta pensada para contraste con
 * texto blanco que usa la web más abajo. Deliberadamente independiente de
 * `categoryColorHex`: cambiar el matiz de la web no debe tocar el color del bot.
 */
export function discordCategoryColorNumber(category: string): number {
  if (category === "Grand Slam") return 0xf1c20f;
  if (category === "Masters 1000") return 0xff0000;
  if (category === "500") return 0xa643ce;
  if (category === "250" || category === "m250") return 0x346edb;
  if (category.includes("CT") || category.includes("Challenger")) return 0x2ecc71;
  if (category === "Future") return 0x1abc9c;
  return 0xa6a6a6;
}

/**
 * Píldoras de categoría de la web (Palmarés de la ficha de jugador) — pedido
 * explícito del propietario: que sean EXACTAMENTE el mismo color que sus roles reales
 * de Discord (lib/discordBot/tasks/syncRoles.ts asigna esos mismos roles por estos
 * mismos logros), no una paleta inventada aparte. Valores leídos directamente de los
 * roles reales del servidor (`role.hexColor` vía discord.js), no adivinados de una
 * captura de pantalla — confirmado 2026-09-07. "Next Gen Finals" y "Exhibition" no
 * tienen rol de Discord equivalente (no están entre los 8 roles reales), así que
 * conservan un color propio sin relación con ningún rol.
 */
export function categoryColorHex(category: string): string {
  if (category === "Grand Slam") return "#f1e10f";
  if (category === "Tour Finals") return "#ff4000";
  if (category === "Masters 1000") return "#ff0010";
  if (category === "Next Gen Finals") return "#DB2777"; // sin rol de Discord — color propio
  if (category === "500") return "#bc43ce";
  if (category === "250" || category === "m250") return "#346edb";
  if (category.includes("CT") || category.includes("Challenger")) return "#2ecc71";
  if (category === "Future") return "#1abc9c";
  if (category === "Exhibition") return "#64748B"; // sin rol de Discord — gris apagado a propósito (no puntúa)
  return "#71717A"; // categoría futura sin clasificar todavía
}

/**
 * Blanco sobre casi todos los colores de arriba, salvo los dos demasiado claros
 * (el amarillo de Grand Slam, el verde de Challenger) — ahí el texto blanco no llega
 * ni de lejos al contraste mínimo legible, así que se usa el navy del propio sitio
 * (`--navy-900`, ver app/globals.css) en su lugar. Luminancia perceptiva estándar
 * (coeficientes ITU-R BT.709) — no es el cálculo de contraste WCAG completo, pero de
 * sobra para decidir blanco-o-navy en una píldora pequeña.
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function categoryTextColor(category: string): string {
  return relativeLuminance(categoryColorHex(category)) > 0.6 ? "#001E5A" : "#FFFFFF";
}

/**
 * Orden de importancia real del circuito, Grand Slam primero — Tour Finals justo
 * detrás de los Slams y por delante de Masters 1000 (pedido explícito), Next Gen
 * Finals entre Masters 1000 y 500 (evento real pero de segunda fila, para jugadores
 * jóvenes, nunca al nivel de los Masters de verdad). Reutilizado para ORDENAR el
 * Palmarés (components/players/PlayerPalmares.tsx), no solo para colorear.
 */
export function categoryRank(category: string): number {
  if (category === "Grand Slam") return 0;
  if (category === "Tour Finals") return 1;
  if (category === "Masters 1000") return 2;
  if (category === "Next Gen Finals") return 3;
  if (category === "500") return 4;
  if (category === "250" || category === "m250") return 5;
  if (category.includes("CT") || category.includes("Challenger")) return 6;
  if (category === "Future") return 7;
  if (category === "Exhibition") return 8;
  return 9;
}
