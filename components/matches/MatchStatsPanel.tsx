import { H2HStatsRow } from "@/components/h2h/H2HStatsRow";

/**
 * Un lado de `match_stats` para un partido concreto — mismas columnas que
 * db/schema.ts, todas nullable porque puede que el partido tenga fila para un
 * jugador y no para el otro (no debería pasar en la práctica: `lib/matchLog/*`
 * siempre escribe las dos a la vez, pero el tipo no lo garantiza).
 */
export interface MatchStatsPanelData {
  aces: number | null;
  doubleFaults: number | null;
  firstServeAttempted: number | null;
  firstServeIn: number | null;
  firstServePointsPlayed: number | null;
  firstServePointsWon: number | null;
  secondServePointsPlayed: number | null;
  secondServePointsWon: number | null;
  breakPointsFaced: number | null;
  breakPointsWon: number | null;
  returnPointsPlayed: number | null;
  returnPointsWon: number | null;
  netPointsPlayed: number | null;
  netPointsWon: number | null;
  winners: number | null;
  forcedErrors: number | null;
  unforcedErrors: number | null;
  totalPointsWon: number | null;
  fastestServeKmh: number | null;
  avgFirstServeSpeedKmh: number | null;
  avgSecondServeSpeedKmh: number | null;
}

function pct(num: number | null, den: number | null): number {
  if (!num || !den) return 0;
  return Math.round((num / den) * 100);
}

function fraction(num: number | null, den: number | null): string | undefined {
  if (num === null || den === null) return undefined;
  return ` (${num}/${den})`;
}

export function MatchStatsPanel({ player1, player2 }: { player1: MatchStatsPanelData; player2: MatchStatsPanelData }) {
  return (
    <div>
      <H2HStatsRow label="ACES" value1={player1.aces ?? 0} value2={player2.aces ?? 0} />
      <H2HStatsRow label="DOUBLE FAULTS" value1={player1.doubleFaults ?? 0} value2={player2.doubleFaults ?? 0} />
      <H2HStatsRow
        label="1ST SERVE %"
        value1={pct(player1.firstServeIn, player1.firstServeAttempted)}
        value2={pct(player2.firstServeIn, player2.firstServeAttempted)}
        detail1={fraction(player1.firstServeIn, player1.firstServeAttempted)}
        detail2={fraction(player2.firstServeIn, player2.firstServeAttempted)}
      />
      <H2HStatsRow
        label="1ST SERVE POINTS WON %"
        value1={pct(player1.firstServePointsWon, player1.firstServePointsPlayed)}
        value2={pct(player2.firstServePointsWon, player2.firstServePointsPlayed)}
        detail1={fraction(player1.firstServePointsWon, player1.firstServePointsPlayed)}
        detail2={fraction(player2.firstServePointsWon, player2.firstServePointsPlayed)}
      />
      <H2HStatsRow
        label="2ND SERVE POINTS WON %"
        value1={pct(player1.secondServePointsWon, player1.secondServePointsPlayed)}
        value2={pct(player2.secondServePointsWon, player2.secondServePointsPlayed)}
        detail1={fraction(player1.secondServePointsWon, player1.secondServePointsPlayed)}
        detail2={fraction(player2.secondServePointsWon, player2.secondServePointsPlayed)}
      />
      <H2HStatsRow
        label="BREAK POINTS WON %"
        value1={pct(player1.breakPointsWon, player1.breakPointsFaced)}
        value2={pct(player2.breakPointsWon, player2.breakPointsFaced)}
        detail1={fraction(player1.breakPointsWon, player1.breakPointsFaced)}
        detail2={fraction(player2.breakPointsWon, player2.breakPointsFaced)}
      />
      <H2HStatsRow
        label="RETURN POINTS WON %"
        value1={pct(player1.returnPointsWon, player1.returnPointsPlayed)}
        value2={pct(player2.returnPointsWon, player2.returnPointsPlayed)}
        detail1={fraction(player1.returnPointsWon, player1.returnPointsPlayed)}
        detail2={fraction(player2.returnPointsWon, player2.returnPointsPlayed)}
      />
      <H2HStatsRow
        label="NET POINTS WON %"
        value1={pct(player1.netPointsWon, player1.netPointsPlayed)}
        value2={pct(player2.netPointsWon, player2.netPointsPlayed)}
        detail1={fraction(player1.netPointsWon, player1.netPointsPlayed)}
        detail2={fraction(player2.netPointsWon, player2.netPointsPlayed)}
      />
      <H2HStatsRow label="WINNERS" value1={player1.winners ?? 0} value2={player2.winners ?? 0} />
      <H2HStatsRow label="FORCED ERRORS" value1={player1.forcedErrors ?? 0} value2={player2.forcedErrors ?? 0} />
      <H2HStatsRow label="UNFORCED ERRORS" value1={player1.unforcedErrors ?? 0} value2={player2.unforcedErrors ?? 0} />
      <H2HStatsRow label="TOTAL POINTS WON" value1={player1.totalPointsWon ?? 0} value2={player2.totalPointsWon ?? 0} />
      <H2HStatsRow
        label="FASTEST SERVE (KM/H)"
        value1={player1.fastestServeKmh ?? 0}
        value2={player2.fastestServeKmh ?? 0}
      />
      <H2HStatsRow
        label="AVG 1ST SERVE SPEED (KM/H)"
        value1={player1.avgFirstServeSpeedKmh ?? 0}
        value2={player2.avgFirstServeSpeedKmh ?? 0}
      />
      <H2HStatsRow
        label="AVG 2ND SERVE SPEED (KM/H)"
        value1={player1.avgSecondServeSpeedKmh ?? 0}
        value2={player2.avgSecondServeSpeedKmh ?? 0}
      />
    </div>
  );
}
