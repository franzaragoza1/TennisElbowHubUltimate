/**
 * Casa una entrada `[Online]` de MatchLog (`parsers/matchLogPage.ts`) contra un
 * partido YA existente en `matches` — nunca al revés, nunca inventando uno nuevo.
 */
import { asc, and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, matches, playerAliases, playerKnownNames, players, sets as setsTable } from "@/db/schema";
import type { ParsedSet } from "@/parsers/schemas";
import { buildNameIndexFromRows, type NameIndex } from "./nameIndex";

/** Tres fuentes de nombre por jugador: el canónico, el que trae `player_aliases`
 * (a veces no resincronizado todavía tras un cambio en Mana) y la lista de motes que
 * el admin añade a mano en `/admin/players/[id]` (`player_known_names`) — ver
 * `lib/matchLog/nameIndex.ts` para por qué hace falta cada una. Se construye UNA VEZ
 * por lote de importación, no una consulta por nombre a resolver. */
export async function buildNameIndex(): Promise<NameIndex> {
  const [displayNames, aliasNames, knownNames] = await Promise.all([
    db.select({ playerId: players.id, name: players.displayName }).from(players),
    db.select({ playerId: playerAliases.playerId, name: playerAliases.displayName }).from(playerAliases),
    db.select({ playerId: playerKnownNames.playerId, name: playerKnownNames.name }).from(playerKnownNames),
  ]);
  return buildNameIndexFromRows([...displayNames, ...aliasNames, ...knownNames]);
}

interface DbSet {
  setNumber: number;
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

function setsEqual(parsed: ParsedSet[], real: DbSet[]): boolean {
  if (parsed.length !== real.length) return false;
  return parsed.every(
    (s, i) =>
      s.winnerGames === real[i].winnerGames &&
      s.loserGames === real[i].loserGames &&
      s.tiebreakLoserPoints === real[i].tiebreakLoserPoints,
  );
}

interface Candidate {
  matchId: number;
  weekStartDate: string | null;
}

/**
 * Busca, entre los partidos ya importados del tour, el que corresponde a esta
 * entrada — por pareja de jugadores y marcador set a set EXACTO. Nunca por fecha:
 * `matches.playedAt` está sin rellenar en casi todo el histórico (ver su comentario en
 * db/schema.ts), así que `editions.weekStartDate` solo se usa como desempate de
 * última instancia si dos partidos entre los mismos jugadores tienen el mismo
 * marcador (revancha con resultado idéntico). `parsedPlayer1Id` es siempre el
 * ganador (así lo escribe el propio fichero, "X def. Y") — si el marcador cuadra
 * pero `matches.winnerId` no coincide, el candidato se descarta.
 */
export async function findTourMatch(
  parsedPlayer1Id: number,
  parsedPlayer2Id: number,
  parsedSets: ParsedSet[],
  playedAt: Date,
): Promise<number | null> {
  const rows = await db
    .select({
      matchId: matches.id,
      winnerId: matches.winnerId,
      weekStartDate: editions.weekStartDate,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .where(
      or(
        and(eq(matches.player1Id, parsedPlayer1Id), eq(matches.player2Id, parsedPlayer2Id)),
        and(eq(matches.player1Id, parsedPlayer2Id), eq(matches.player2Id, parsedPlayer1Id)),
      ),
    );

  const candidates: Candidate[] = [];
  for (const row of rows) {
    if (row.winnerId !== parsedPlayer1Id) continue;
    const matchSets = await db
      .select({
        setNumber: setsTable.setNumber,
        winnerGames: setsTable.winnerGames,
        loserGames: setsTable.loserGames,
        tiebreakLoserPoints: setsTable.tiebreakLoserPoints,
      })
      .from(setsTable)
      .where(eq(setsTable.matchId, row.matchId))
      .orderBy(asc(setsTable.setNumber));
    if (setsEqual(parsedSets, matchSets)) {
      candidates.push({ matchId: row.matchId, weekStartDate: row.weekStartDate });
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].matchId;

  const withDate = candidates
    .filter((c): c is Candidate & { weekStartDate: string } => c.weekStartDate !== null)
    .map((c) => ({ ...c, diff: Math.abs(new Date(c.weekStartDate).getTime() - playedAt.getTime()) }))
    .sort((a, b) => a.diff - b.diff);

  if (withDate.length === 0) return null;
  if (withDate.length > 1 && withDate[0].diff === withDate[1].diff) return null;
  return withDate[0].matchId;
}
