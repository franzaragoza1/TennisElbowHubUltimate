/**
 * Las cuatro categorías de /stats y lo que la página explica de cada una (2026-10-17,
 * rediseño de Stats). Los Ratings siguen las fórmulas publicadas de la ATP, menos lo que
 * el MatchLog no permite calcular de verdad (quién sacaba cada juego) — `leftOut` lo dice
 * en la propia página, en vez de dejar creer que el número es el de la ATP.
 */
export type StatGroup = "serve" | "return" | "pressure" | "shotmaking";

export interface StatGroupInfo {
  value: StatGroup;
  /** Pestaña y título de la tarjeta. */
  label: string;
  /** Una línea: qué mide. */
  blurb: string;
  /** Cómo se calcula la cifra de cabecera. */
  formula: string;
  /** Lo que la ATP incluye y aquí no, y por qué (null = nada). */
  leftOut: string | null;
  /** Condición para entrar, si hay más que el mínimo de partidos. */
  requirement: string | null;
  /** Texto bajo la cifra de cabecera en las tarjetas. */
  ratingLabel: string;
}

export const STAT_GROUPS: StatGroupInfo[] = [
  {
    value: "serve",
    label: "Serve",
    blurb: "Who wins the most points on their own serve.",
    formula: "Serve Rating = 1st serve % + 1st serve points won % + 2nd serve points won % + aces per match − double faults per match.",
    leftOut: "The ATP also adds service games won %. Match logs don't say who served each game, so it isn't included.",
    requirement: null,
    ratingLabel: "Serve Rating",
  },
  {
    value: "return",
    label: "Return",
    blurb: "Who wins the most points on the opponent's serve.",
    formula: "Return Rating = 1st serve return points won % + 2nd serve return points won % + break points converted %.",
    leftOut: "The ATP also adds return games won %. Match logs don't say who served each game, so it isn't included.",
    requirement: null,
    ratingLabel: "Return Rating",
  },
  {
    value: "pressure",
    label: "Under pressure",
    blurb: "Who plays the big moments best.",
    formula: "Under Pressure Rating = break points converted % + break points saved % + tie-breaks won % + deciding sets won %.",
    leftOut: null,
    requirement:
      "Tie-breaks and deciding sets are counted from the score of every match in the period, not only the ones with recorded stats. A player needs at least one of each to be listed.",
    ratingLabel: "Pressure Rating",
  },
  {
    value: "shotmaking",
    label: "Shot making",
    blurb: "Who takes the points, at the net and from the baseline.",
    formula: "Ranked by total points won %. Also shown: net points won %, winners and unforced errors per match, and winners per unforced error.",
    leftOut: null,
    requirement: null,
    ratingLabel: "Points won",
  },
];

export function isStatGroup(value: string | undefined): value is StatGroup {
  return STAT_GROUPS.some((g) => g.value === value);
}

export function statGroupInfo(value: StatGroup): StatGroupInfo {
  return STAT_GROUPS.find((g) => g.value === value)!;
}
