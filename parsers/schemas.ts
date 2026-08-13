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

export const TournamentPageSchema = z.object({
  edition: EditionSchema,
  matches: z.array(MatchSchema),
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
