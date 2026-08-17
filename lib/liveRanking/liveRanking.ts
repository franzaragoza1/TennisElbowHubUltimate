import type { RankedPlayer } from "@/lib/tourQueries";
import { getLiveWeek } from "./liveWeek";
import { getSecuredPointsByPlayer, getPendingParticipants } from "./securedPoints";
import { findMatchingPriorYearWeek, getExpiringPointsByPlayer } from "./expiringPoints";
import { getCurrentTournamentStatus } from "./currentTournament";

export interface LiveCurrentTournament {
  tournamentName: string;
  sentence: string;
}

export interface LiveRankedPlayer extends RankedPlayer {
  livePoints: number;
  /** livePoints - points (el oficial de partida) — positivo o negativo. */
  pointsDelta: number;
  currentTournament: LiveCurrentTournament | null;
}

/**
 * Aplica el ajuste en vivo a una lista YA COMPLETA de jugadores (no solo un top N —
 * el llamador tiene que pedir el ranking entero para que un jugador que sube de
 * puesto por puntos en vivo pueda entrar en el recorte final; recortar top N antes de
 * reordenar dejaría fuera a quien lo mereciera). Reordena por puntos en vivo y
 * renumera el rank en consecuencia.
 *
 * `kind`: 'official' resta lo que expira esta semana (rolling window); 'race' no resta
 * nada, solo suma lo asegurado en el torneo en curso (la Race no expira puntos, ver
 * docs/decisiones.md).
 *
 * Si no hay ningún torneo en curso ahora mismo, no hay "semana en vivo" que
 * proyectar — se devuelve la lista tal cual, en vivo y oficial coinciden.
 */
export async function getLiveRanking(kind: "official" | "race", baseRows: RankedPlayer[]): Promise<LiveRankedPlayer[]> {
  const liveWeek = await getLiveWeek();
  if (!liveWeek) {
    // Sin torneo en curso, el rank en vivo coincide exactamente con el oficial —
    // "movido" en vivo es 0 para todos, no el `moved` oficial de la semana pasada
    // (mismo motivo que el recálculo de más abajo: son dos cosas distintas).
    return baseRows.map((r) => ({ ...r, livePoints: r.points, pointsDelta: 0, currentTournament: null, moved: 0 }));
  }

  const securedPromise = getSecuredPointsByPlayer(liveWeek.editionIds);
  const pendingPromise = getPendingParticipants(liveWeek.editionIds);
  const expiringPromise =
    kind === "official"
      ? findMatchingPriorYearWeek(liveWeek.isoYear, liveWeek.isoWeek).then((prior) =>
          prior ? getExpiringPointsByPlayer(prior.isoYear, prior.isoWeek) : new Map<number, number>(),
        )
      : Promise.resolve(new Map<number, number>());

  const [secured, pending, expiring] = await Promise.all([securedPromise, pendingPromise, expiringPromise]);

  const adjusted = await Promise.all(
    baseRows.map(async (r) => {
      const gain = secured.get(r.playerId);
      const loss = expiring.get(r.playerId) ?? 0;
      const livePoints = Math.max(0, r.points - loss + (gain?.points ?? 0));

      // Un jugador que ya aseguró puntos usa esa edición para la narrativa; uno que
      // todavía no ha debutado en el torneo en curso no tiene puntos que asegurar
      // (0, correcto) pero sí puede tener un cruce ya emparejado en `pending_slots` —
      // sin esto, su fila se quedaba sin "Current Tournament" aunque estuviera
      // jugando ahora mismo.
      const narrativeSource = gain ?? pending.get(r.playerId);
      const currentTournament = narrativeSource
        ? await getCurrentTournamentStatus(r.playerId, narrativeSource.editionId, narrativeSource.drawSize).then((status) =>
            status ? { tournamentName: narrativeSource.tournamentName, sentence: status.sentence } : null,
          )
        : null;

      return { ...r, livePoints, pointsDelta: livePoints - r.points, currentTournament };
    }),
  );

  adjusted.sort((a, b) => b.livePoints - a.livePoints);
  // `r.moved` en este punto sigue siendo el oficial (semana en curso vs. anterior,
  // `ranking_snapshots.moved`) — en vivo no vale: hay que comparar el rank oficial
  // (`r.rank`, todavía sin tocar aquí) contra el puesto que le toca ya reordenado por
  // puntos en vivo, no contra la semana pasada. Sin este recálculo, la flecha de
  // +/- en vivo enseñaba el movimiento oficial de siempre, igual en las dos vistas.
  return adjusted.map((r, i) => {
    const liveRank = i + 1;
    return { ...r, rank: liveRank, moved: r.rank - liveRank };
  });
}
