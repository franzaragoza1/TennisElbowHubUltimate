/**
 * `editions.surface` es texto libre (decisión de la fase 3: sin enum, fiel a la
 * fuente). Para el filete de color de la cabecera del torneo basta con reconocer las
 * familias de superficie que aparecen de verdad en los datos: "Blue-Green Cement",
 * "Clay", "Green Clay", "Grass", "Indoor Concrete", "Indoor Carpet",
 * "NewLine Synthetic", "Cement"... Una superficie sin reconocer sale con el color
 * neutro en vez de romper nada.
 */
const SURFACE_COLORS: { match: RegExp; color: string }[] = [
  { match: /clay/i, color: "#c2571a" },
  { match: /grass/i, color: "#3e8e41" },
  { match: /carpet/i, color: "#5b3a8e" },
  { match: /concrete|cement|hard|synthetic/i, color: "#0057b8" },
];

const DEFAULT_SURFACE_COLOR = "#6b7280";

export function surfaceColor(surface: string | null): string {
  if (!surface) return DEFAULT_SURFACE_COLOR;
  return SURFACE_COLORS.find((s) => s.match.test(surface))?.color ?? DEFAULT_SURFACE_COLOR;
}
