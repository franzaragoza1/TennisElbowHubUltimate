/**
 * Lógica pura de clasificación — separada de `opponentForm.ts` (que trae los datos de
 * BD) para poder testearla sin mockear la base de datos, mismo criterio que
 * lib/predictor/preMatchModel.ts / liveModel.ts en este mismo repo.
 */
const GREAT_STREAK = 5;
const SOLID_STREAK = 3;
const GREAT_MAX_SETS_LOST_IN_STREAK = 1;
const SOLID_MIN_WIN_RATE = 0.7;
const NORMAL_MIN_WIN_RATE = 0.5;
const MEDIOCRE_MIN_WIN_RATE = 0.25;

export type OpponentFormTier = "Bad" | "Mediocre" | "Normal" | "Solid" | "Great";

export interface OpponentFormResult {
  tier: OpponentFormTier;
  /** Solo relleno para Solid/Great — nunca para Bad/Mediocre/Normal (pedido
   * explícito: esas tres no se mencionan en la entrevista). */
  note: string | null;
}

export interface RecentMatchOutcome {
  won: boolean;
  /** Sets perdidos EN ESE partido — solo importa cuando `won` es true (una racha de
   * victorias con pocos sets perdidos es la señal de "Great" que pide el hueco de
   * "very little sets lost"). */
  setsLost: number;
}

/** `recent` viene del más reciente al más antiguo — igual que
 * lib/newsGeneration/recentForm.ts en el resto de este archivo. Vacío (debut, sin
 * historial) cae en "Normal" sin nota: un debutante no tiene forma que juzgar
 * todavía, nunca se le trata como si estuviera jugando mal. */
export function computeFormTier(recent: RecentMatchOutcome[]): OpponentFormResult {
  if (recent.length === 0) return { tier: "Normal", note: null };

  let streak = 0;
  let setsLostInStreak = 0;
  for (const m of recent) {
    if (!m.won) break;
    streak++;
    setsLostInStreak += m.setsLost;
  }

  const wins = recent.filter((m) => m.won).length;
  const winRate = wins / recent.length;
  const last5 = recent.slice(0, 5);
  const losses5 = last5.filter((m) => !m.won).length;

  if (streak >= GREAT_STREAK) return { tier: "Great", note: `on a ${streak}-match win streak` };
  if (streak >= SOLID_STREAK && setsLostInStreak <= GREAT_MAX_SETS_LOST_IN_STREAK) {
    return { tier: "Great", note: `on a ${streak}-match win streak, dropping just ${setsLostInStreak} set${setsLostInStreak === 1 ? "" : "s"}` };
  }
  if (streak >= SOLID_STREAK) return { tier: "Solid", note: `on a ${streak}-match win streak` };
  if (winRate >= SOLID_MIN_WIN_RATE && losses5 <= 1) return { tier: "Solid", note: `won ${wins} of their last ${recent.length}` };
  if (winRate >= NORMAL_MIN_WIN_RATE) return { tier: "Normal", note: null };
  if (winRate >= MEDIOCRE_MIN_WIN_RATE) return { tier: "Mediocre", note: null };
  return { tier: "Bad", note: null };
}
