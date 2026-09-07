/**
 * Casa una entrada `[Online]` de MatchLog (`parsers/matchLogPage.ts`) contra un
 * partido YA existente en `matches` — nunca al revés, nunca inventando uno nuevo.
 */
import { asc, and, eq, inArray, or } from "drizzle-orm";
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
 * pero `matches.winnerId` no coincide, el candidato se descarta — filtrado ya en SQL,
 * no trayendo también los perdidos para descartarlos después.
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
      weekStartDate: editions.weekStartDate,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .where(
      and(
        eq(matches.winnerId, parsedPlayer1Id),
        or(
          and(eq(matches.player1Id, parsedPlayer1Id), eq(matches.player2Id, parsedPlayer2Id)),
          and(eq(matches.player1Id, parsedPlayer2Id), eq(matches.player2Id, parsedPlayer1Id)),
        ),
      ),
    );

  if (rows.length === 0) return null;

  // UN solo viaje a la base de datos para los sets de TODOS los candidatos —
  // antes era una consulta por candidato, dentro de este mismo bucle: con varios
  // enfrentamientos previos entre los mismos dos jugadores, eso significaba varias
  // idas y vueltas por CADA entrada del fichero, multiplicado por cientos de entradas
  // en un fichero grande. El cuello de botella real al subir un MatchLog completo.
  const matchIds = rows.map((r) => r.matchId);
  const allSets = await db
    .select({
      matchId: setsTable.matchId,
      setNumber: setsTable.setNumber,
      winnerGames: setsTable.winnerGames,
      loserGames: setsTable.loserGames,
      tiebreakLoserPoints: setsTable.tiebreakLoserPoints,
    })
    .from(setsTable)
    .where(inArray(setsTable.matchId, matchIds))
    .orderBy(asc(setsTable.setNumber));
  const setsByMatch = new Map<number, DbSet[]>();
  for (const s of allSets) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push(s);
  }

  const candidates: Candidate[] = [];
  for (const row of rows) {
    if (setsEqual(parsedSets, setsByMatch.get(row.matchId) ?? [])) {
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
