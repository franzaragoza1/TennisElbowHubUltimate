/**
 * Lecturas compartidas de premios — sin `requireAdmin`/`requireUser` aquí (eso lo
 * hace quien llame, ver app/admin/awards/actions.ts y app/awards/actions.ts), para
 * poder reusarlas igual desde el panel de admin, la página pública y, más adelante,
 * las tareas del bot de Discord (Fase 6, todavía no implementada).
 */
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { awardNominations, awardPeriods, editions, events, matches, matchVideos, players, recentResults, sets as setsTable } from "@/db/schema";
import { getAwardCategory } from "@/lib/awards/catalog";
import type { MatchSetScore } from "@/lib/matchScore";

export interface AwardPeriodRow {
  id: number;
  cycle: string; // 'monthly' | 'yearly'
  year: number;
  month: number | null;
  status: string; // 'draft' | 'voting' | 'closed'
  speech: string | null;
  votingOpensAt: Date | null;
  votingClosesAt: Date | null;
}

const PERIOD_COLUMNS = {
  id: awardPeriods.id,
  cycle: awardPeriods.cycle,
  year: awardPeriods.year,
  month: awardPeriods.month,
  status: awardPeriods.status,
  speech: awardPeriods.speech,
  votingOpensAt: awardPeriods.votingOpensAt,
  votingClosesAt: awardPeriods.votingClosesAt,
};

export async function listAwardPeriods(): Promise<AwardPeriodRow[]> {
  return db.select(PERIOD_COLUMNS).from(awardPeriods).orderBy(desc(awardPeriods.year), desc(awardPeriods.month), desc(awardPeriods.id));
}

export async function getAwardPeriod(periodId: number): Promise<AwardPeriodRow | null> {
  const [row] = await db.select(PERIOD_COLUMNS).from(awardPeriods).where(eq(awardPeriods.id, periodId));
  return row ?? null;
}

/** El período más reciente abierto a voto — se asume como mucho uno vivo a la vez
 * (mismo criterio operativo documentado en el plan), igual que
 * app/awards/actions.ts::submitPointOfMonthClip asume un único draft mensual vivo. */
export async function getCurrentVotingPeriod(): Promise<AwardPeriodRow | null> {
  const [row] = await db.select(PERIOD_COLUMNS).from(awardPeriods).where(eq(awardPeriods.status, "voting")).orderBy(desc(awardPeriods.votingOpensAt)).limit(1);
  return row ?? null;
}

export async function getClosedPeriods(limit = 12): Promise<AwardPeriodRow[]> {
  return db
    .select(PERIOD_COLUMNS)
    .from(awardPeriods)
    .where(eq(awardPeriods.status, "closed"))
    .orderBy(desc(awardPeriods.votingClosesAt))
    .limit(limit);
}

/**
 * Condición SQL "este partido cae dentro del período" — compartida entre el buscador
 * de partido del admin (app/admin/awards/actions.ts::searchMatchCandidatesForPeriod) y
 * el del propio jugador al enviar un clip (app/awards/actions.ts::
 * searchMyMatchCandidates), para no mantener la misma lógica de fecha en dos sitios.
 *
 * Un mensual NO se puede acotar por `editions.weekStartDate`: esa fecha es UNA sola
 * por torneo entero (cuándo empezó), y un Grand Slam dura semanas — un torneo que
 * empezó en agosto pero cuyas rondas se jugaron y reportaron en septiembre quedaba
 * fuera entero de "September" (bug real reportado: "Matches from US Open not found
 * for September nominees... there were a lot of matches in September for it").
 * `recent_results.reportedAt` sí es una fecha por PARTIDO (Day+Time real del reporte,
 * ver el comentario de esa tabla en db/schema.ts) — se usa esa cuando existe, con
 * fallback a `editions.weekStartDate` solo para partidos sin fila en recent_results
 * (histórico previo a este ticker, o Finals espejadas, que nunca pasan por Mana). Un
 * anual sigue acotado por `editions.year` (temporada), sin este problema de borde: un
 * torneo entero rara vez cruza de un año de temporada al siguiente.
 *
 * Requiere que la consulta que llame a esto ya tenga un LEFT JOIN de `recentResults`
 * contra `matches` (mismo natural key que announceResults.ts: editionId+round+par
 * ganador/perdedor en cualquier orden) y un JOIN normal de `editions`.
 */
export function periodDateFilter(period: Pick<AwardPeriodRow, "cycle" | "year" | "month">) {
  if (period.cycle === "monthly" && period.month) {
    const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
    const endYear = period.month === 12 ? period.year + 1 : period.year;
    const endMonth = period.month === 12 ? 1 : period.month + 1;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    return or(
      and(gte(recentResults.reportedAt, new Date(start)), lt(recentResults.reportedAt, new Date(end))),
      and(isNull(recentResults.reportedAt), gte(editions.weekStartDate, start), lt(editions.weekStartDate, end)),
    );
  }
  return eq(editions.year, period.year);
}

/** El JOIN que `periodDateFilter` necesita para su rama mensual — mismo natural key
 * que lib/discordBot/tasks/announceResults.ts (editionId+round+par ganador/perdedor
 * en cualquier orden, `matches.id` no es estable entre recargas de torneo). Factorizado
 * aquí porque tanto el buscador de partido del admin como el del propio jugador lo
 * necesitan calcado. */
export function recentResultsJoinCondition() {
  return and(
    eq(recentResults.editionId, matches.editionId),
    eq(recentResults.round, matches.round),
    or(
      and(eq(matches.player1Id, recentResults.winnerId), eq(matches.player2Id, recentResults.loserId)),
      and(eq(matches.player1Id, recentResults.loserId), eq(matches.player2Id, recentResults.winnerId)),
    ),
  );
}

export interface MatchScorePlayer {
  id: number;
  displayName: string;
  country: string | null;
  seed: number | null;
}

/** Marcador completo de un partido nominado — enseñado en la tarjeta de nominado
 * (components/awards/NomineeCard.tsx) con el mismo componente de puntuación que el
 * resto del sitio (lib/matchScore.ts::scoreFromPerspective), pedido explícito: "Add
 * score, stats and video if available to nominees structured like the other
 * screenshot" (una tarjeta de partido al estilo ATP con marcador y highlights). */
export interface MatchScoreDetail {
  round: string;
  outcome: string;
  drawSize: number;
  eventName: string;
  year: number;
  winner: MatchScorePlayer;
  loser: MatchScorePlayer;
  sets: MatchSetScore[];
  /** Solo 'auto'/'confirmed' (ver db/schema.ts::matchVideos) — un vídeo 'pending'
   * todavía no lo ha revisado un admin, y 'rejected' se descartó. null si no hay
   * ninguno enlazado, o si el nominado no lleva partido. */
  youtubeVideoId: string | null;
}

export interface NominationDisplay {
  id: number;
  categoryKey: string;
  status: string; // 'pending' | 'approved' | 'rejected'
  clipUrl: string | null;
  caption: string | null;
  createdAt: Date;
  playerId: number | null;
  playerName: string | null;
  playerCountry: string | null;
  /** Cuenta de Discord vinculada del nominado, si tiene — solo hace falta para poder
   * pingarlo de verdad al anunciar un ganador (lib/discordBot/tasks/
   * announceAwardsVotingClosed.ts::mentionOrBold), nada más lo usa. */
  playerLinkedUserId: string | null;
  matchId: number | null;
  /** "P1 vs P2 — Event Year (Round)", null si esta nominación no lleva partido
   * (nomineeKind 'player', ver lib/awards/catalog.ts). */
  matchLabel: string | null;
  /** Notación fuente tal cual ("6/3 7/6(5)", ver matches.scoreRaw) — mismo criterio que
   * lib/discordBot/tasks/announceResults.ts: se enseña literal, sin reconstruir desde
   * `sets`. Pedido explícito: los anuncios de premios deben enseñar el marcador de los
   * partidos nominados, no solo el rótulo del cruce. null si no lleva partido o ese
   * partido no tiene marcador registrado. */
  scoreRaw: string | null;
  /** null si esta nominación no lleva partido, o si ese partido todavía no tiene
   * marcador registrado (cruce sin decidir). */
  matchDetail: MatchScoreDetail | null;
  /** Recuento final leído del sondeo real de Discord al cerrarse (ver
   * lib/discordBot/tasks/syncAwardsPollResults.ts) — null mientras la votación sigue
   * abierta, o si esta nominación no llegó a entrar en votación. */
  manualVoteCount: number | null;
  /** Mensaje de Discord que lleva el sondeo de esta categoría — compartido por todos
   * los nominados de la misma categoría+período (ver db/schema.ts::awardNominations).
   * null hasta que el bot publique la votación de este período. */
  discordPollMessageId: string | null;
}

/** Todos los nominados de un período, cualquiera que sea su estado — quien la llame
 * decide qué enseñar (el admin ve pending/approved/rejected, la página pública solo
 * approved, ver getPeriodNominationsForPublic). */
export async function getNominationsForPeriod(periodId: number, statuses?: string[]): Promise<NominationDisplay[]> {
  const p1 = alias(players, "award_nom_p1");
  const p2 = alias(players, "award_nom_p2");
  const nomineePlayer = alias(players, "award_nom_player");

  const rows = await db
    .select({
      id: awardNominations.id,
      categoryKey: awardNominations.categoryKey,
      status: awardNominations.status,
      clipUrl: awardNominations.clipUrl,
      caption: awardNominations.caption,
      createdAt: awardNominations.createdAt,
      playerId: awardNominations.playerId,
      playerName: nomineePlayer.displayName,
      // coalesce con countryOverride, no country a secas — mismo criterio que
      // lib/scoresQueries.ts: un jugador con nacionalidad corregida a mano tiene que
      // enseñar esa, no la scrapeada, en cualquier sitio del site que pinte su bandera.
      playerCountry: sql<string | null>`coalesce(${nomineePlayer.countryOverride}, ${nomineePlayer.country})`,
      playerLinkedUserId: nomineePlayer.linkedUserId,
      manualVoteCount: awardNominations.manualVoteCount,
      discordPollMessageId: awardNominations.discordPollMessageId,
      matchId: awardNominations.matchId,
      matchRound: matches.round,
      matchOutcome: matches.outcome,
      matchScoreRaw: matches.scoreRaw,
      matchWinnerId: matches.winnerId,
      matchDrawSize: editions.drawSize,
      matchYear: editions.year,
      eventName: events.displayName,
      player1Id: p1.id,
      player1Name: p1.displayName,
      player1Country: sql<string | null>`coalesce(${p1.countryOverride}, ${p1.country})`,
      player1Seed: matches.player1Seed,
      player2Id: p2.id,
      player2Name: p2.displayName,
      player2Country: sql<string | null>`coalesce(${p2.countryOverride}, ${p2.country})`,
      player2Seed: matches.player2Seed,
    })
    .from(awardNominations)
    .leftJoin(nomineePlayer, eq(nomineePlayer.id, awardNominations.playerId))
    .leftJoin(matches, eq(matches.id, awardNominations.matchId))
    .leftJoin(editions, eq(editions.id, matches.editionId))
    .leftJoin(events, eq(events.id, editions.eventId))
    .leftJoin(p1, eq(p1.id, matches.player1Id))
    .leftJoin(p2, eq(p2.id, matches.player2Id))
    .where(statuses ? and(eq(awardNominations.periodId, periodId), inArray(awardNominations.status, statuses)) : eq(awardNominations.periodId, periodId))
    .orderBy(awardNominations.createdAt);

  const matchIds = [...new Set(rows.map((r) => r.matchId).filter((id): id is number => id !== null))];

  const [setRows, videoRows] = await Promise.all([
    matchIds.length > 0 ? db.select().from(setsTable).where(inArray(setsTable.matchId, matchIds)) : Promise.resolve([]),
    matchIds.length > 0
      ? db
          .select({ matchId: matchVideos.matchId, youtubeVideoId: matchVideos.youtubeVideoId })
          .from(matchVideos)
          .where(and(inArray(matchVideos.matchId, matchIds), inArray(matchVideos.status, ["auto", "confirmed"])))
      : Promise.resolve([]),
  ]);

  const setsByMatch = new Map<number, MatchSetScore[]>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push({ setNumber: s.setNumber, winnerGames: s.winnerGames, loserGames: s.loserGames, tiebreakLoserPoints: s.tiebreakLoserPoints });
  }
  for (const list of setsByMatch.values()) list.sort((a, b) => a.setNumber - b.setNumber);
  const videoByMatch = new Map(videoRows.filter((v) => v.matchId !== null).map((v) => [v.matchId as number, v.youtubeVideoId]));

  return rows.map((r) => {
    const matchLabel = r.matchId ? `${r.player1Name} vs ${r.player2Name} — ${r.eventName} ${r.matchYear} (${r.matchRound})` : null;

    let matchDetail: MatchScoreDetail | null = null;
    if (r.matchId && r.matchWinnerId && r.player1Id && r.player2Id && r.matchDrawSize) {
      const winnerIsPlayer1 = r.matchWinnerId === r.player1Id;
      const winner: MatchScorePlayer = winnerIsPlayer1
        ? { id: r.player1Id, displayName: r.player1Name!, country: r.player1Country, seed: r.player1Seed }
        : { id: r.player2Id, displayName: r.player2Name!, country: r.player2Country, seed: r.player2Seed };
      const loser: MatchScorePlayer = winnerIsPlayer1
        ? { id: r.player2Id, displayName: r.player2Name!, country: r.player2Country, seed: r.player2Seed }
        : { id: r.player1Id, displayName: r.player1Name!, country: r.player1Country, seed: r.player1Seed };
      matchDetail = {
        round: r.matchRound!,
        outcome: r.matchOutcome!,
        drawSize: r.matchDrawSize,
        eventName: r.eventName!,
        year: r.matchYear!,
        winner,
        loser,
        sets: setsByMatch.get(r.matchId) ?? [],
        youtubeVideoId: videoByMatch.get(r.matchId) ?? null,
      };
    }

    return {
      id: r.id,
      categoryKey: r.categoryKey,
      status: r.status,
      clipUrl: r.clipUrl,
      caption: r.caption,
      createdAt: r.createdAt,
      playerId: r.playerId,
      playerName: r.playerName,
      playerCountry: r.playerCountry,
      playerLinkedUserId: r.playerLinkedUserId,
      matchId: r.matchId,
      matchLabel,
      scoreRaw: r.matchId ? r.matchScoreRaw : null,
      matchDetail,
      manualVoteCount: r.manualVoteCount,
      discordPollMessageId: r.discordPollMessageId,
    };
  });
}

export interface CategoryResult {
  categoryKey: string;
  nominees: (NominationDisplay & { voteCount: number })[];
  /** El nominado con más votos, o null si esta categoría no tiene ningún nominado
   * aprobado este período (categoría sin nadie que enseñar, se omite de la votación —
   * ver el comentario de openVoting en app/admin/awards/actions.ts). Empate: gana el
   * nominado añadido antes (createdAt más antiguo, ya viene ordenado así). */
  winner: (NominationDisplay & { voteCount: number }) | null;
}

/** Recuento y ganador por categoría — leído directo de `manualVoteCount` (el recuento
 * que el bot volcó del sondeo de Discord al cerrarse, ver
 * lib/discordBot/tasks/syncAwardsPollResults.ts), nunca calculado a partir de votos
 * propios del sitio — esa tabla ya no existe, se vota en Discord. */
export async function getPeriodResults(periodId: number): Promise<CategoryResult[]> {
  const nominations = await getNominationsForPeriod(periodId, ["approved"]);

  const byCategory = new Map<string, NominationDisplay[]>();
  for (const n of nominations) {
    if (!byCategory.has(n.categoryKey)) byCategory.set(n.categoryKey, []);
    byCategory.get(n.categoryKey)!.push(n);
  }

  return [...byCategory.entries()].map(([categoryKey, nominees]) => {
    const withCounts = nominees.map((n) => ({ ...n, voteCount: n.manualVoteCount ?? 0 }));
    const winner = withCounts.reduce<(NominationDisplay & { voteCount: number }) | null>(
      (best, n) => (best === null || n.voteCount > best.voteCount ? n : best),
      null,
    );
    return { categoryKey, nominees: withCounts, winner };
  });
}

export interface PlayerAwardWin {
  period: AwardPeriodRow;
  categoryKey: string;
}

/**
 * Cada categoría de un período CERRADO que este jugador ganó de verdad — para la
 * sección "Awards" de la ficha pública, mismo criterio que getPalmares (lib/h2hStats.ts):
 * derivado de datos ya decididos, nunca autodeclarado. Solo se miran los períodos
 * donde el jugador tiene al menos una nominación aprobada, así que el número de
 * llamadas a getPeriodResults es pequeño en la práctica (un jugador rara vez entra en
 * más que un puñado de períodos).
 *
 * Para nomineeKind 'match' (Match of the Month/Year, ver lib/awards/catalog.ts) no
 * hay un solo "nominado ganador" — el premio es del PARTIDO, así que se le atribuye a
 * los DOS jugadores que lo jugaron, igual que un título de dobles se cuenta para
 * ambos integrantes de la pareja.
 */
export async function getPlayerAwardWins(playerId: number): Promise<PlayerAwardWin[]> {
  const periodRows = await db
    .selectDistinct({ periodId: awardNominations.periodId })
    .from(awardNominations)
    .innerJoin(awardPeriods, eq(awardPeriods.id, awardNominations.periodId))
    .where(and(eq(awardNominations.playerId, playerId), eq(awardNominations.status, "approved"), eq(awardPeriods.status, "closed")));

  const wins: PlayerAwardWin[] = [];
  for (const { periodId } of periodRows) {
    const period = await getAwardPeriod(periodId);
    if (!period) continue;
    const results = await getPeriodResults(periodId);
    for (const r of results) {
      if (!r.winner) continue;
      const nomineeKind = getAwardCategory(r.categoryKey)?.nomineeKind;
      const wonDirectly = r.winner.playerId === playerId;
      // Solo 'match' reparte el crédito entre los dos jugadores del partido — un
      // 'player_in_match' (Point/Upset of the Month) SÍ lleva partido también, pero
      // ahí el premio es del nominado concreto, no de su rival en ese cruce.
      const wonAsMatchParticipant = nomineeKind === "match" && r.winner.matchDetail !== null && (r.winner.matchDetail.winner.id === playerId || r.winner.matchDetail.loser.id === playerId);
      if (wonDirectly || wonAsMatchParticipant) wins.push({ period, categoryKey: r.categoryKey });
    }
  }

  return wins.sort((a, b) => b.period.year - a.period.year || (b.period.month ?? 13) - (a.period.month ?? 13));
}
