import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, bracketPredictions, byes, editionRoundDeadlines, editions, matches, pendingSlots, players } from "@/db/schema";
import { tournamentCircuit } from "@/lib/tournamentCircuit";
import { fullRoundLadder, buildBracketLayout, roundDisplayLabel } from "@/lib/bracket";
import { getBracketMatchesForEdition } from "@/lib/tournamentBracketData";
import { scorePrediction, type BracketPick } from "./scoring";
import { extractMarqueePicks, getPlayerExitRound } from "./marqueePicks";
import { applyQualifierResolution, QUALIFIER_ID_BASE, type QualifierSlotResolution } from "./qualifierPlaceholder";

/**
 * Un solo viaje a la base de datos por EDICIÓN (nunca por fila de predicción) —
 * mira `pending_slots`/`matches` de la primera ronda del Main Draw TAL CUAL ESTÁN
 * AHORA MISMO. Nunca hace falta saber si un hueco concreto fue alguna vez un
 * "Qualifier #N": el id sintético de `encodeQualifierPlaceholderId` ya lleva
 * codificada su posición de origen, así que `applyQualifierResolution` solo
 * necesita "qué hay ahora en cada `sortIndex`" para sustituirlo.
 */
async function getQualifierSlotResolution(editionId: number): Promise<QualifierSlotResolution> {
  const [edition] = await db.select({ drawSize: editions.drawSize }).from(editions).where(eq(editions.id, editionId));
  const firstRound = edition ? fullRoundLadder(edition.drawSize)[0] : undefined;
  if (!firstRound) return new Map();

  const [pendingRows, matchRows] = await Promise.all([
    db
      .select({ sortIndex: pendingSlots.sortIndex, player1Id: pendingSlots.player1Id, player2Id: pendingSlots.player2Id })
      .from(pendingSlots)
      .where(and(eq(pendingSlots.editionId, editionId), eq(pendingSlots.round, firstRound))),
    db
      .select({ sortIndex: matches.sortIndex, player1Id: matches.player1Id, player2Id: matches.player2Id })
      .from(matches)
      .where(and(eq(matches.editionId, editionId), eq(matches.round, firstRound))),
  ]);
  const currentBySortIndex: QualifierSlotResolution = new Map();
  for (const r of pendingRows) currentBySortIndex.set(r.sortIndex, r);
  // Un partido real siempre trae los dos lados reales — pisa cualquier fila de
  // `pending_slots` que quedara para el mismo hueco (no debería coexistir, pero un
  // `matches` decidido es la fuente de verdad más reciente si acaso).
  for (const r of matchRows) if (r.sortIndex !== null) currentBySortIndex.set(r.sortIndex, r);
  return currentBySortIndex;
}

/** Envoltorio de conveniencia para un único llamante (`getMyPrediction`) — para
 * varias filas de la misma edición a la vez, pide `getQualifierSlotResolution` UNA
 * vez y aplica `applyQualifierResolution` por fila en su lugar (ver
 * `getPredictionLeaderboard`/`getGlobalPredictionLeaderboard`). */
async function resolveQualifierPicks(editionId: number, picks: BracketPick[]): Promise<BracketPick[]> {
  if (!picks.some((p) => p.playerId >= QUALIFIER_ID_BASE)) return picks;
  const resolution = await getQualifierSlotResolution(editionId);
  return applyQualifierResolution(picks, resolution);
}

/**
 * Torneo del circuito principal (nunca Challenger/Futures, mismo filtro que el
 * carrusel de ganadores y el widget de H2H del sidebar) con su primera ronda del
 * cuadro principal ya publicada del todo — un hueco reservado a quien gane la
 * clasificación ("Qualifier #N" literal en el cuadro fuente, ver
 * lib/tournamentBracketData.ts) cuenta como publicado, no como un TBD pendiente:
 * es un candidato legítimo y elegible en Bracket Predictions, no una señal de que
 * el cuadro sigue incompleto. Un TBD sin ese texto (sin causa documentada distinta
 * en los datos de esta fuente) sigue bloqueando, exactamente como antes.
 *
 * Bug real encontrado simulando un torneo completo de principio a fin (2026-09-18): un
 * hueco de R1 decidido se BORRA de `pending_slots` y pasa a `matches` (mismo patrón que
 * en todos los loaders) — mirar solo `pending_slots` significaba que en cuanto la
 * ronda 1 terminaba de jugarse del todo, esta función pasaba a devolver `false` para
 * SIEMPRE, aunque las predicciones hubiesen sido legítimas cuando se enviaron. Eso
 * rompía la propia página `/predict` justo para el caso que más falta hace verla: un
 * torneo ya bloqueado y terminado, con marcador y clasificación reales que enseñar.
 * `isPredictionEligible` tiene que responder "¿la ronda 1 llegó alguna vez a publicarse
 * completa?", no "¿sigue con huecos pendientes ahora mismo?" — de ahí que sume también
 * `matches`/`byes` de esa ronda (que por definición nunca son TBD) al comprobar que
 * hubo algo real donde empezar.
 */
export async function isPredictionEligible(editionId: number): Promise<boolean> {
  const [edition] = await db.select({ category: editions.category, drawSize: editions.drawSize }).from(editions).where(eq(editions.id, editionId));
  if (!edition || tournamentCircuit(edition.category) !== "tour") return false;

  const firstRound = fullRoundLadder(edition.drawSize)[0];
  if (!firstRound) return false;

  const [pendingRows, decidedRows, byeRows] = await Promise.all([
    db
      .select({ player1Id: pendingSlots.player1Id, player2Id: pendingSlots.player2Id, player1QualifierNumber: pendingSlots.player1QualifierNumber, player2QualifierNumber: pendingSlots.player2QualifierNumber })
      .from(pendingSlots)
      .where(and(eq(pendingSlots.editionId, editionId), eq(pendingSlots.round, firstRound))),
    db.select({ id: matches.id }).from(matches).where(and(eq(matches.editionId, editionId), eq(matches.round, firstRound))).limit(1),
    db.select({ id: byes.id }).from(byes).where(and(eq(byes.editionId, editionId), eq(byes.round, firstRound))).limit(1),
  ]);

  const everHadFirstRound = pendingRows.length > 0 || decidedRows.length > 0 || byeRows.length > 0;
  const noTbdLeft = pendingRows.every(
    (s) => (s.player1Id !== null || s.player1QualifierNumber !== null) && (s.player2Id !== null || s.player2QualifierNumber !== null),
  );
  return everHadFirstRound && noTbdLeft;
}

export interface PredictionLockInfo {
  locked: boolean;
  deadlineAt: Date | null;
}

/**
 * Bloqueada cuando ya no queda NADA real que adivinar en la primera ronda (todos sus
 * huecos de `pending_slots` se han convertido en partidos reales) o en cuanto exista un
 * partido real de una ronda POSTERIOR a la primera, o en cuanto pase el plazo publicado
 * de la primera ronda — lo que llegue antes.
 *
 * Antes esto bloqueaba con el PRIMER partido real de la edición entera, sin importar la
 * ronda — pedido explícito del propietario (2026-09-18): en este tour la ronda 1 se
 * juega a ritmo propio de cada pareja (no todos a la vez como en un cuadro de estadio),
 * así que el primer partido de R1 podía jugarse casi al momento de publicarse el cuadro,
 * cerrando las predicciones de TODO EL MUNDO antes de que nadie tuviera tiempo real de
 * enviar una entrada. Ahora la ventana de envío sigue abierta mientras la ronda 1 se va
 * decidiendo hueco a hueco — `PredictionBracket` (cliente) muestra cada hueco de R1 ya
 * decidido como jugado (no elegible) y cada hueco en vivo como no elegible tampoco
 * (`useLiveScores`), dejando predecir solo los huecos de R1 que de verdad siguen
 * abiertos — y solo cierra del todo cuando la ronda 1 entera está decidida o la ronda 2
 * ya ha empezado.
 */
export async function getPredictionLockInfo(editionId: number): Promise<PredictionLockInfo> {
  const [edition] = await db.select({ drawSize: editions.drawSize }).from(editions).where(eq(editions.id, editionId));
  const ladder = edition ? fullRoundLadder(edition.drawSize) : [];
  const firstRound = ladder[0];
  const laterRounds = ladder.slice(1);

  const [[deadlineRow], firstRoundPending, [laterRoundMatch]] = await Promise.all([
    firstRound
      ? db.select({ deadlineAt: editionRoundDeadlines.deadlineAt }).from(editionRoundDeadlines).where(and(eq(editionRoundDeadlines.editionId, editionId), eq(editionRoundDeadlines.round, firstRound)))
      : Promise.resolve([]),
    firstRound ? db.select({ id: pendingSlots.id }).from(pendingSlots).where(and(eq(pendingSlots.editionId, editionId), eq(pendingSlots.round, firstRound))).limit(1) : Promise.resolve([]),
    laterRounds.length > 0
      ? db.select({ id: matches.id }).from(matches).where(and(eq(matches.editionId, editionId), inArray(matches.round, laterRounds))).limit(1)
      : Promise.resolve([]),
  ]);

  const deadlineAt = deadlineRow?.deadlineAt ?? null;
  const firstRoundComplete = firstRound !== undefined && firstRoundPending.length === 0;
  const locked = firstRoundComplete || laterRoundMatch !== undefined || (deadlineAt !== null && deadlineAt.getTime() <= Date.now());
  return { locked, deadlineAt };
}

export async function getMyPrediction(editionId: number, userId: string): Promise<BracketPick[] | null> {
  const [row] = await db.select({ picks: bracketPredictions.picks }).from(bracketPredictions).where(and(eq(bracketPredictions.editionId, editionId), eq(bracketPredictions.userId, userId)));
  if (!row) return null;
  return resolveQualifierPicks(editionId, row.picks);
}

/** Cuántos brackets se han enviado ya para esta edición — prueba social en la tarjeta
 * de invitación de la página del torneo, nada más. */
export async function getPredictionEntryCount(editionId: number): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(bracketPredictions).where(eq(bracketPredictions.editionId, editionId));
  return row?.count ?? 0;
}

/** Un nombre "de cartel" (campeón, finalista, semifinalista) de la fila de un
 * predictor, con hasta dónde llegó DE VERDAD ese jugador en el cuadro real — pedido
 * explícito del propietario (2026-09-18), calcado de una tabla real de referencia. */
export interface MarqueePickDisplay {
  playerId: number | null;
  displayName: string | null;
  country: string | null;
  /** "W" (ganó el torneo), la etiqueta de ronda real en la que quedó eliminado
   * ("F", "SF", "R32"...), "Alive" (todavía sigue en juego, sin desenlace todavía), o
   * `null` si no hay pick para este hueco o el jugador nunca ha aparecido en un
   * partido decidido de esta edición. */
  roundLabel: string | null;
  /** `null` = nada que comparar todavía (sin pick, o el jugador sigue vivo sin
   * desenlace). `true`/`false` = acertó o no la categoría EXACTA que se le pedía a
   * este hueco — el campeón tiene que haber ganado de verdad, el finalista tiene que
   * haber PERDIDO la final de verdad (si en realidad ganó, es un campeón, no vale
   * como acierto de "finalista"), cada semifinalista tiene que haber perdido su
   * semifinal de verdad. Nunca "llegó al menos hasta ahí". */
  correct: boolean | null;
}

export interface LeaderboardRow {
  userId: string;
  userName: string | null;
  userImage: string | null;
  score: number;
  champion: MarqueePickDisplay;
  finalist: MarqueePickDisplay;
  semifinalist1: MarqueePickDisplay;
  semifinalist2: MarqueePickDisplay;
}

/** Un `getBracketMatchesForEdition` + `buildBracketLayout` COMPARTIDO entre todas las
 * predicciones de la edición, no uno por usuario — lo caro es reconstruir el cuadro
 * real, no puntuar una lista de picks contra él (eso es una función pura barata). Los
 * nombres/país de todos los jugadores "de cartel" de TODAS las filas se piden en una
 * sola consulta, no una por fila ni una por hueco. */
export async function getPredictionLeaderboard(editionId: number): Promise<LeaderboardRow[]> {
  const [rows, allMatches] = await Promise.all([
    db
      .select({ userId: bracketPredictions.userId, picks: bracketPredictions.picks, userName: authUsers.name, userImage: authUsers.image })
      .from(bracketPredictions)
      .innerJoin(authUsers, eq(authUsers.id, bracketPredictions.userId))
      .where(eq(bracketPredictions.editionId, editionId)),
    getBracketMatchesForEdition(editionId),
  ]);
  if (rows.length === 0) return [];

  const layout = buildBracketLayout(allMatches);
  const roundOrder = layout.roundOrder;
  const lastRound = roundOrder[roundOrder.length - 1];
  const semiRound = roundOrder.length >= 2 ? roundOrder[roundOrder.length - 2] : undefined;

  // Una sola resolución de picks de clasificación por EDICIÓN, no una por fila —
  // mismo criterio de lote que ya usa esta función para el cuadro y los nombres.
  const qualifierResolution = await getQualifierSlotResolution(editionId);
  const withMarquee = rows.map((r) => {
    const picks = applyQualifierResolution(r.picks, qualifierResolution);
    return { ...r, score: scorePrediction(picks, layout).total, marquee: extractMarqueePicks(picks, layout) };
  });

  const allPlayerIds = new Set<number>();
  for (const { marquee } of withMarquee) {
    for (const id of [marquee.championId, marquee.finalistId, marquee.semifinalist1Id, marquee.semifinalist2Id]) {
      if (id !== null) allPlayerIds.add(id);
    }
  }
  const playerRows =
    allPlayerIds.size > 0
      ? await db
          .select({ id: players.id, displayName: players.displayName, country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})` })
          .from(players)
          .where(inArray(players.id, [...allPlayerIds]))
      : [];
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  function displayFor(playerId: number | null, category: "champion" | "finalist" | "semifinalist"): MarqueePickDisplay {
    if (playerId === null) return { playerId: null, displayName: null, country: null, roundLabel: null, correct: null };
    const info = playerById.get(playerId);
    const displayName = info?.displayName ?? null;
    const country = info?.country ?? null;
    const exit = getPlayerExitRound(layout, playerId);

    if (exit === null) return { playerId, displayName, country, roundLabel: null, correct: null };
    if (exit.kind === "alive") return { playerId, displayName, country, roundLabel: "Alive", correct: null };
    if (exit.kind === "champion") return { playerId, displayName, country, roundLabel: "W", correct: category === "champion" };

    const roundLabel = roundDisplayLabel(roundOrder, exit.round);
    const requiredRound = category === "finalist" ? lastRound : category === "semifinalist" ? semiRound : undefined;
    const correct = category !== "champion" && requiredRound !== undefined && exit.round === requiredRound;
    return { playerId, displayName, country, roundLabel, correct };
  }

  return withMarquee
    .map((r) => ({
      userId: r.userId,
      userName: r.userName,
      userImage: r.userImage,
      score: r.score,
      champion: displayFor(r.marquee.championId, "champion"),
      finalist: displayFor(r.marquee.finalistId, "finalist"),
      semifinalist1: displayFor(r.marquee.semifinalist1Id, "semifinalist"),
      semifinalist2: displayFor(r.marquee.semifinalist2Id, "semifinalist"),
    }))
    .sort((a, b) => b.score - a.score);
}

export interface GlobalLeaderboardRow {
  userId: string;
  userName: string | null;
  userImage: string | null;
  totalScore: number;
  tournamentsPredicted: number;
}

/** Temporada de la clasificación de predictores: el año en curso, mismo criterio que
 * `getCareerStats`/`getPreMatchFactors` usan ya para "esta temporada" en el resto del
 * sitio (`new Date().getFullYear()`, nunca un `currentSeason` propio). Pedido
 * explícito del propietario (2026-09-18): "points should be removed at some point"
 * para que la clasificación siga siendo competitiva — se reinicia sola en cuanto
 * cambia el año, sin borrar nada de `bracket_predictions` (las de temporadas
 * anteriores simplemente dejan de sumar aquí). */
export function currentPredictionSeason(): number {
  return new Date().getFullYear();
}

/** Clasificación de predictores de TODOS los torneos DE LA TEMPORADA EN CURSO a la vez
 * (pedido explícito del propietario, 2026-09-18: página propia, estilo del Rankings
 * principal, no solo el marcador de un torneo suelto) — un `getBracketMatchesForEdition`
 * + `buildBracketLayout` por EDICIÓN (no por fila de predicción, que sería repetir el
 * mismo cuadro una vez por cada persona que lo predijo), sumando `scorePrediction`
 * por usuario a través de todas las ediciones de esta temporada donde tiene una
 * predicción guardada. */
export async function getGlobalPredictionLeaderboard(): Promise<GlobalLeaderboardRow[]> {
  const rows = await db
    .select({
      editionId: bracketPredictions.editionId,
      userId: bracketPredictions.userId,
      picks: bracketPredictions.picks,
      userName: authUsers.name,
      userImage: authUsers.image,
    })
    .from(bracketPredictions)
    .innerJoin(authUsers, eq(authUsers.id, bracketPredictions.userId))
    .innerJoin(editions, eq(editions.id, bracketPredictions.editionId))
    .where(eq(editions.year, currentPredictionSeason()));
  if (rows.length === 0) return [];

  const rowsByEdition = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = rowsByEdition.get(row.editionId) ?? [];
    list.push(row);
    rowsByEdition.set(row.editionId, list);
  }

  const totals = new Map<string, GlobalLeaderboardRow>();
  for (const [editionId, editionRows] of rowsByEdition) {
    const layout = buildBracketLayout(await getBracketMatchesForEdition(editionId));
    const qualifierResolution = await getQualifierSlotResolution(editionId);
    for (const row of editionRows) {
      const score = scorePrediction(applyQualifierResolution(row.picks, qualifierResolution), layout).total;
      const existing = totals.get(row.userId);
      if (existing) {
        existing.totalScore += score;
        existing.tournamentsPredicted += 1;
      } else {
        totals.set(row.userId, { userId: row.userId, userName: row.userName, userImage: row.userImage, totalScore: score, tournamentsPredicted: 1 });
      }
    }
  }

  return [...totals.values()].sort((a, b) => b.totalScore - a.totalScore || b.tournamentsPredicted - a.tournamentsPredicted);
}
