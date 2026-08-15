import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, events, matches, players } from "@/db/schema";
import { parseMatchTitle } from "./titleParser";

export interface MatchLookupResult {
  status: "auto" | "pending" | "unmatched";
  /** El partido a enlazar cuando `status === 'auto'`; null en cualquier otro caso —
   * en 'pending' no se adivina, se deja para que el admin elija entre `candidateMatchIds`. */
  matchId: number | null;
  /** En 'pending', exactamente los partidos ya jugados entre los dos rivales
   * resueltos — nada más amplio. Vacío si no hay ninguno o si el título no llegó a
   * resolver a dos jugadores. */
  candidateMatchIds: number[];
  reason: string;
}

/** Resolución de nombre contra el pool completo de jugadores. Exacta primero; si no
 * hay ninguna coincidencia exacta, substring — pero solo si es de un único jugador,
 * nunca se adivina entre varios candidatos. */
async function resolvePlayerId(name: string): Promise<number | null> {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;

  const all = await db.select({ id: players.id, displayName: players.displayName }).from(players);
  const exact = all.filter((p) => p.displayName.toLowerCase() === lower);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;

  const partial = all.filter(
    (p) => p.displayName.toLowerCase().includes(lower) || lower.includes(p.displayName.toLowerCase()),
  );
  return partial.length === 1 ? partial[0].id : null;
}

/** Comparación laxa de nombre de torneo: el título puede llevar el nombre completo
 * ("Indian Wells Masters") mientras la ficha del evento en base de datos guarda solo
 * una parte, o al revés — de ahí la contención en los dos sentidos. */
function tournamentNameMatches(eventName: string, titleTournamentName: string): boolean {
  const a = eventName.trim().toLowerCase();
  const b = titleTournamentName.trim().toLowerCase();
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

/**
 * A partir de un título ya parseado, busca a qué partido de `matches` corresponde.
 *   - 'unmatched': el título no encaja con el formato fijo del canal, o los nombres no
 *     resuelven a un único jugador cada uno, o esos dos jugadores nunca se han cruzado.
 *   - 'auto': año + torneo (y, si hace falta, ronda) del título señalan sin ambigüedad
 *     uno solo de los cruces entre esos dos jugadores.
 *   - 'pending': el título no basta para elegir uno solo — se exponen exactamente los
 *     partidos ya jugados entre esos dos jugadores (`candidateMatchIds`), nada más, para
 *     que un admin elija a mano. Sin mejor suposición: mejor pedir que adivinar mal.
 */
export async function findMatchForVideoTitle(title: string): Promise<MatchLookupResult> {
  const parsed = parseMatchTitle(title);
  if (!parsed) {
    return {
      status: "unmatched",
      matchId: null,
      candidateMatchIds: [],
      reason: "Title does not match the channel's fixed format (\"Tennis Elbow 4 <Tournament> <Year> <Round> P1 vs P2 (Online)\")",
    };
  }

  const [p1Id, p2Id] = await Promise.all([resolvePlayerId(parsed.player1Name), resolvePlayerId(parsed.player2Name)]);
  if (!p1Id || !p2Id) {
    return { status: "unmatched", matchId: null, candidateMatchIds: [], reason: "Could not resolve one or both player names to a single player" };
  }
  if (p1Id === p2Id) {
    return { status: "unmatched", matchId: null, candidateMatchIds: [], reason: "Both names resolved to the same player" };
  }

  const candidates = await db
    .select({ id: matches.id, round: matches.round, eventName: events.displayName, year: editions.year })
    .from(matches)
    .innerJoin(editions, eq(matches.editionId, editions.id))
    .innerJoin(events, eq(editions.eventId, events.id))
    .where(
      or(
        and(eq(matches.player1Id, p1Id), eq(matches.player2Id, p2Id)),
        and(eq(matches.player1Id, p2Id), eq(matches.player2Id, p1Id)),
      ),
    );

  if (candidates.length === 0) {
    return { status: "unmatched", matchId: null, candidateMatchIds: [], reason: "Players resolved, but they have no recorded match against each other" };
  }
  if (candidates.length === 1) {
    return { status: "auto", matchId: candidates[0].id, candidateMatchIds: [], reason: "Only match on record between these two players" };
  }

  const byYearAndTournament = candidates.filter(
    (c) => c.year === parsed.year && tournamentNameMatches(c.eventName, parsed.tournamentName),
  );
  if (byYearAndTournament.length === 1) {
    return { status: "auto", matchId: byYearAndTournament[0].id, candidateMatchIds: [], reason: `Narrowed by tournament and year ("${parsed.tournamentName}", ${parsed.year})` };
  }
  if (byYearAndTournament.length > 1) {
    const byRoundToo = byYearAndTournament.filter((c) => c.round.toLowerCase() === parsed.round.toLowerCase());
    if (byRoundToo.length === 1) {
      return { status: "auto", matchId: byRoundToo[0].id, candidateMatchIds: [], reason: `Narrowed by tournament, year and round ("${parsed.tournamentName}" ${parsed.year} ${parsed.round})` };
    }
  }

  return {
    status: "pending",
    matchId: null,
    candidateMatchIds: candidates.map((c) => c.id),
    reason: `${candidates.length} matches on record between these two players — the title's tournament/year/round didn't narrow it down to one`,
  };
}
