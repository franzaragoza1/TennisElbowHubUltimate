/**
 * `editions.surface` es texto libre (decisión de la fase 3: sin enum, fiel a la
 * fuente). Para el filete de color de la cabecera del torneo basta con reconocer las
 * familias de superficie que aparecen de verdad en los datos: "Blue-Green Cement",
 * "Clay", "Green Clay", "Grass", "Indoor Concrete", "Indoor Carpet",
 * "NewLine Synthetic", "Cement"... Una superficie sin reconocer sale con el color
 * neutro en vez de romper nada.
 */
// "Carpet" vivía como familia propia (morado) hasta el pase de reclasificación
// pedido explícito (2026-09-17): la pista indoor de moqueta ahora se enseña como
// "Indoor Hard" (ver SURFACE_DISPLAY_LABELS más abajo) — dejarla con un color propio
// distinto de las demás pistas "Hard" se leería como una inconsistencia real (dos
// tarjetas con el mismo texto "Indoor Hard" pero un filete de color distinto).
export type SurfaceFamily = "Hard" | "Clay" | "Grass";

const SURFACE_FAMILIES: { match: RegExp; family: SurfaceFamily; color: string }[] = [
  { match: /clay/i, family: "Clay", color: "#c2571a" },
  { match: /grass/i, family: "Grass", color: "#3e8e41" },
  { match: /concrete|cement|hard|synthetic|carpet/i, family: "Hard", color: "#0057b8" },
];

const DEFAULT_SURFACE_COLOR = "#6b7280";

export function surfaceColor(surface: string | null): string {
  if (!surface) return DEFAULT_SURFACE_COLOR;
  return SURFACE_FAMILIES.find((s) => s.match.test(surface))?.color ?? DEFAULT_SURFACE_COLOR;
}

/** Agrupa el texto libre de `editions.surface` (docenas de variantes reales: "Blue-
 * Green Cement", "Green Clay", "Indoor Concrete", "NewLine Synthetic"...) en las
 * cuatro familias que ya distingue `surfaceColor` — para un filtro de calendario, un
 * desplegable con una entrada por cada variante exacta sería inservible. `null` (Tour
 * Finals, sin pista real) no entra en ninguna familia: se excluye del filtro, no se
 * inventa una. */
export function surfaceFamily(surface: string | null): SurfaceFamily | null {
  if (!surface) return null;
  return SURFACE_FAMILIES.find((s) => s.match.test(surface))?.family ?? null;
}

/**
 * Traduce el texto libre de `editions.surface` a la etiqueta que de verdad se enseña
 * en el sitio — pedido explícito (2026-09-17): "Blue-Green Cement" o "NewLine
 * Synthetic" no dicen nada a quien no conozca ya el juego; "Outdoor Hard" sí. Solo
 * traduce estas cuatro variantes conocidas — cualquier otra (Clay, Grass, Green
 * Clay...) sale tal cual, sin inventar una traducción para algo que no se pidió.
 * Nunca se usa para `surfaceColor`/`surfaceFamily`: esos siguen leyendo el valor
 * real, esto es solo para el texto que se enseña.
 */
const SURFACE_DISPLAY_LABELS: Record<string, string> = {
  "blue-green cement": "Outdoor Hard",
  "newline synthetic": "Outdoor Hard",
  "indoor concrete": "Indoor Hard",
  "indoor carpet": "Indoor Hard",
};

export function surfaceDisplayLabel(surface: string | null): string | null {
  if (!surface) return null;
  return SURFACE_DISPLAY_LABELS[surface.trim().toLowerCase()] ?? surface;
}
