/**
 * Fuente única de las claves/categorías del "Build" — antes duplicado tres veces
 * (components/account/PlayerBuildForm.tsx, components/players/PlayerBuildCard.tsx,
 * lib/buildScreenshotOcr.ts) y a punto de una cuarta copia con la retirada de
 * "Short Term Form" (pedido explícito, "not useful to keep"); consolidado aquí para
 * que quitar/añadir un stat solo haga falta tocarlo en un sitio.
 *
 * Costes de puntos (lib/buildPoints.ts) según qué lista pertenece cada stat:
 * - TIERED: cuesta 1/2/3 puntos por punto de porcentaje según tramo (0-60/60-90/90-100).
 * - FLAT: siempre 1 punto por punto de porcentaje, sin tramos (Smash, Counter, Lob,
 *   Drop shot — pedido explícito del propietario).
 * - FREE: no cuesta nada (Top Spin) — a diferencia de Short Term Form, que TAMPOCO
 *   costaba nada pero se retiró del todo del sitio en vez de mantenerse como "free".
 */
/** Pedido explícito: hasta 3 builds guardadas por jugador, cada una con su propio
 * nombre — antes era 1:1 con el jugador (db/schema.ts::playerBuilds ya no tiene
 * `unique` en playerId). Contado server-side en
 * app/account/actions.ts::createPlayerBuild antes de insertar. */
export const MAX_BUILDS_PER_PLAYER = 3;
export const MAX_BUILD_NAME_LENGTH = 40;

export const TIERED_STAT_KEYS = [
  "forehandPower",
  "forehandConsistency",
  "forehandPrecision",
  "backhandPower",
  "backhandConsistency",
  "backhandPrecision",
  "servicePower",
  "serviceConsistency",
  "servicePrecision",
  "forehandVolley",
  "backhandVolley",
  "netPresence",
  "focus",
  "speed",
  "stamina",
  "muscleTone",
] as const;

export const FLAT_STAT_KEYS = ["smash", "counter", "lob", "dropShot"] as const;

export const FREE_STAT_KEYS = ["topSpin"] as const;

export const ALL_STAT_KEYS = [...TIERED_STAT_KEYS, ...FLAT_STAT_KEYS, ...FREE_STAT_KEYS] as const;

export type StatKey = (typeof ALL_STAT_KEYS)[number];

export interface StatSection {
  title: string;
  fields: { key: StatKey; label: string }[];
}

export const STAT_SECTIONS: StatSection[] = [
  {
    title: "Rally",
    fields: [
      { key: "forehandPower", label: "Forehand power" },
      { key: "forehandConsistency", label: "Forehand consistency" },
      { key: "forehandPrecision", label: "Forehand precision" },
      { key: "backhandPower", label: "Backhand power" },
      { key: "backhandConsistency", label: "Backhand consistency" },
      { key: "backhandPrecision", label: "Backhand precision" },
    ],
  },
  {
    title: "Service",
    fields: [
      { key: "servicePower", label: "Service power" },
      { key: "serviceConsistency", label: "Service consistency" },
      { key: "servicePrecision", label: "Service precision" },
    ],
  },
  {
    title: "Volley",
    fields: [
      { key: "forehandVolley", label: "Forehand volley" },
      { key: "backhandVolley", label: "Backhand volley" },
      { key: "smash", label: "Smash" },
      { key: "netPresence", label: "Net presence" },
    ],
  },
  {
    title: "Special",
    fields: [
      { key: "focus", label: "Focus" },
      { key: "counter", label: "Counter" },
      { key: "lob", label: "Lob" },
      { key: "dropShot", label: "Drop shot" },
      { key: "topSpin", label: "Top spin" },
    ],
  },
  {
    title: "Physique",
    fields: [
      { key: "speed", label: "Speed" },
      { key: "stamina", label: "Stamina" },
      { key: "muscleTone", label: "Muscle tone" },
    ],
  },
];

/** Los 9 valores reales del juego — pedido explícito: selección cerrada, ya no texto
 * libre (antes se guardaba lo que el jugador tecleara). */
export const ACCELERATION_TRAITS = [
  "Regular",
  "Panzer",
  "Slow Ball Big Speed",
  "Instant Accelerator",
  "Sporadic Accelerator",
  "In-Flow Accelerator",
  "Heavy Hitter",
  "Rapid Fire",
  "Momentum",
] as const;

export type AccelerationTrait = (typeof ACCELERATION_TRAITS)[number];

/** Los 9 arquetipos reales del juego — pedido explícito: selección cerrada, igual
 * criterio que ACCELERATION_TRAITS (antes texto libre). */
export const ARCHETYPES = [
  "All-Rounder",
  "Bulldog",
  "Defender",
  "Power Baseliner",
  "Puncher",
  "All-court Attacker",
  "Volleyer",
  "Counter",
  "Counter Puncher",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];
