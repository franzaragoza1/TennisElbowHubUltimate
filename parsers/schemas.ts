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

/** Puntos que otorga alcanzar una ronda, tal como los publica el propio cuadro
 * fuente (`<td class="Points">`, una celda por columna de ronda, docs/estructura.md
 * §"Cuadro") — nunca calculados por nosotros. Incluye el literal `W` para el
 * escalón de campeón (ganar la ronda `F`), que no es una ronda jugable en
 * `MatchSchema.round` pero sí una columna real de la fila de puntos. */
export const RoundPointsSchema = z.object({
  round: z.string(),
  points: z.number().int().nonnegative(),
});
export type ParsedRoundPoints = z.infer<typeof RoundPointsSchema>;

export const TournamentPageSchema = z.object({
  edition: EditionSchema,
  matches: z.array(MatchSchema),
  /** Fusión de la fila de puntos de todas las tablas `Ot` de la edición — cuando un
   * cuadro se divide en varias tablas (64+ jugadores, docs/estructura.md), la columna
   * de frontera (p.ej. `Q`) aparece en ambas con el mismo valor; se guarda una vez. */
  roundPoints: z.array(RoundPointsSchema),
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

/** Una fila de `OT_LastResults.php` — a diferencia de un partido del cuadro
 * (`MatchSchema`), esto SÍ trae cuándo se reportó de verdad (`reportedAt`, Day+Time
 * combinados) y quién lo reportó, dos datos que no existen en ningún otro sitio de la
 * fuente (docs/estructura.md §4). El enlace al torneo ya trae el `Trn=` directamente
 * — no hace falta casar por nombre, el id de la edición sale gratis del propio HTML. */
export const RecentResultSchema = z.object({
  reportedAt: z.string(), // ISO 8601 completo, 'YYYY-MM-DDTHH:mm:ss'
  tournamentExternalId: z.string(), // el Trn=
  tournamentName: z.string(),
  competition: z.string(),
  round: z.string(),
  winner: PlayerRefSchema,
  loser: PlayerRefSchema,
  scoreRaw: z.string(),
  outcome: OutcomeSchema,
  sets: z.array(SetSchema),
  /** null si el reportero no viene como enlace (rarísimo, pero el HTML no lo garantiza). */
  reporter: PlayerRefSchema.nullable(),
});
export type ParsedRecentResult = z.infer<typeof RecentResultSchema>;

export const LastResultsPageSchema = z.object({
  results: z.array(RecentResultSchema),
});
export type ParsedLastResultsPage = z.infer<typeof LastResultsPageSchema>;
