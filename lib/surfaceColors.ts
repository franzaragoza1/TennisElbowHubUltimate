/**
 * `editions.surface` es texto libre (decisión de la fase 3: sin enum, fiel a la
 * fuente). Para el filete de color de la cabecera del torneo basta con reconocer las
 * familias de superficie que aparecen de verdad en los datos: "Blue-Green Cement",
 * "Clay", "Green Clay", "Grass", "Indoor Concrete", "Indoor Carpet",
 * "NewLine Synthetic", "Cement"... Una superficie sin reconocer sale con el color
 * neutro en vez de romper nada.
 */
export type SurfaceFamily = "Hard" | "Clay" | "Grass" | "Carpet";

const SURFACE_FAMILIES: { match: RegExp; family: SurfaceFamily; color: string }[] = [
  { match: /clay/i, family: "Clay", color: "#c2571a" },
  { match: /grass/i, family: "Grass", color: "#3e8e41" },
  { match: /carpet/i, family: "Carpet", color: "#5b3a8e" },
  { match: /concrete|cement|hard|synthetic/i, family: "Hard", color: "#0057b8" },
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
