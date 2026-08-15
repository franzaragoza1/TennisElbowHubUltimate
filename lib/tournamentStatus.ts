/**
 * Estado de una edición, derivado de sus partidos — no es una columna, se calcula
 * (CLAUDE.md prefiere derivar de los datos ya importados antes que guardar un estado
 * redundante que se pueda desincronizar). La regla sale directa de `docs/estructura.md`
 * §3: sin ninguna tabla "Main Draw" el torneo sigue en inscripción; con partidos pero
 * sin ronda 'F' resuelta, sigue en juego; con la 'F' resuelta, terminado — el marcador
 * de esa ronda solo existe en el HTML fuente una vez el campeón está decidido.
 */
export type TournamentStatus = "registration" | "ongoing" | "completed";

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  registration: "Registration Open",
  ongoing: "Ongoing",
  completed: "Completed",
};

/**
 * `hasDraw` tiene que venir de partidos decididos + byes + huecos pendientes, NUNCA
 * solo de partidos decididos — un Main Draw recién generado (Winston Salem 2026,
 * "R32" completo con cruces reales tipo "bencu vs Ruze") no tiene NINGÚN partido
 * decidido todavía, solo huecos `pending`, y salía como "Registration Open" a pesar de
 * tener cuadro real ya publicado (ver docs/decisiones.md).
 */
export function deriveTournamentStatus(matches: { round: string }[], hasDraw: boolean): TournamentStatus {
  if (!hasDraw) return "registration";
  return matches.some((m) => m.round === "F") ? "completed" : "ongoing";
}
