import { z } from "zod";

export const PlayerRefSchema = z.object({
  externalId: z.string(),
  displayName: z.string(),
  seed: z.number().int().nullable().optional(),
});
export type PlayerRef = z.infer<typeof PlayerRefSchema>;

export const SetSchema = z.object({
  setNumber: z.number().int().positive(),
  winnerGames: z.number().int().nonnegative(),
  loserGames: z.number().int().nonnegative(),
  tiebreakLoserPoints: z.number().int().nonnegative().nullable(),
});
export type ParsedSet = z.infer<typeof SetSchema>;

export const OutcomeSchema = z.enum(["played", "walkover", "retired", "disqualified", "random"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const MatchSchema = z.object({
  round: z.string(),
  player1: PlayerRefSchema,
  player2: PlayerRefSchema,
  winnerExternalId: z.string(),
  outcome: OutcomeSchema,
  scoreRaw: z.string().nullable(),
  sets: z.array(SetSchema),
  /** Posición real, de arriba abajo, dentro de SU RONDA en la rejilla fuente — no un
   * índice global. Es lo que permite reconstruir el orden verdadero del cuadro sin
   * adivinar nada (ver `ByeSchema` para el porqué hacía falta). */
  sortIndex: z.number().int().nonnegative(),
});
export type ParsedMatch = z.infer<typeof MatchSchema>;

export const EditionSchema = z.object({
  externalId: z.string(),
  eventName: z.string(),
  year: z.number().int(),
  isoWeek: z.number().int().nullable(),
  weekStartDate: z.string().nullable(), // 'YYYY-MM-DD'
  surface: z.string(),
  category: z.string(),
  competition: z.string(),
  drawSize: z.number().int().positive(),
  queueCount: z.number().int().nullable(),
  queueCapacity: z.number().int().nullable(),
  seeds: z.number().int().nullable(),
  officialTopicUrl: z.string().nullable(),
});
export type ParsedEdition = z.infer<typeof EditionSchema>;

export const ByeSchema = z.object({
  round: z.string(),
  player: PlayerRefSchema,
  /** Misma idea que `MatchSchema.sortIndex` — posición real dentro de la ronda,
   * compartiendo el mismo contador que los partidos de esa ronda (un bye y un partido
   * ocupan el mismo tipo de "hueco" en la rejilla), así que un bye y un partido de la
   * misma ronda se pueden intercalar en su orden real, no solo cada lista por separado. */
  sortIndex: z.number().int().nonnegative(),
});
export type ParsedBye = z.infer<typeof ByeSchema>;

export const PendingSlotSchema = z.object({
  round: z.string(),
  sortIndex: z.number().int().nonnegative(),
  /** null = todavía no se sabe quién ocupa este lado ("TBD" en el cuadro fuente, sin
   * enlace a jugador). Si NO es null pero tampoco hay marcador, es un cruce ya
   * emparejado y pendiente de jugarse (los dos lados se conocen, el resultado no). */
  player1: PlayerRefSchema.nullable(),
  player2: PlayerRefSchema.nullable(),
});
export type ParsedPendingSlot = z.infer<typeof PendingSlotSchema>;

export const TournamentPageSchema = z.object({
  edition: EditionSchema,
  matches: z.array(MatchSchema),
  /** Byes reales, tal como aparecen en el cuadro fuente — un jugador emparejado
   * contra la celda "Bye" en una ronda concreta. Antes se descartaban del todo (solo
   * se guardaban partidos con los dos lados reales); sin ellos, el frontend tenía que
   * ADIVINAR quién tuvo un bye y en qué ronda a partir de en qué ronda reaparece cada
   * jugador — adivinanza que se rompe en cuadros irregulares (ver docs/decisiones.md,
   * bug de Cincinnati 2026 Trn=2092: un jugador que entra directo en R2, sin bye en R1,
   * se etiquetaba con un bye inventado en R1 porque "reaparece en la ronda 2" es
   * indistinguible de "tuvo un bye en la ronda 1" sin este dato). */
  byes: z.array(ByeSchema),
  /** Huecos del cuadro sin resolver todavía — ni partido decidido ni bye, tal como
   * aparecen en el cuadro fuente (incluida la tabla de rondas finales, donde casi
   * todo suele ser "TBD" mientras el torneo está en curso). Antes se descartaban en
   * silencio; pedido explícito: el cuadro se enseña completo desde el principio, con
   * huecos "TBD" en vez de simplemente no mostrar esas tarjetas. */
  pending: z.array(PendingSlotSchema),
});
export type ParsedTournamentPage = z.infer<typeof TournamentPageSchema>;

export const RankingRowSchema = z.object({
  rank: z.number().int().positive(),
  moved: z.number().int(),
  player: PlayerRefSchema,
  country: z.string().nullable(),
  points: z.number().int().nonnegative(),
  smallTrn: z.number().int().nullable(),
});
export type ParsedRankingRow = z.infer<typeof RankingRowSchema>;

export const RankingPageSchema = z.object({
  isoYear: z.number().int(),
  isoWeek: z.number().int(),
  rows: z.array(RankingRowSchema),
});
export type ParsedRankingPage = z.infer<typeof RankingPageSchema>;
