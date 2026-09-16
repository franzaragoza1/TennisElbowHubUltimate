import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sources,
  events,
  editions,
  matches,
  sets,
  pendingSlots,
  finalsEditions,
  finalsMatches,
  finalsSets,
  finalsParticipants,
} from "@/db/schema";
import { stageRound } from "./stageRound";

/**
 * `finals_matches`/`finals_sets` siguen siendo la fuente de verdad del flujo de
 * admin (seeding, grupos, suplencias) — esto solo ESPEJA cada partido ya decidido en
 * `matches`/`sets`, bajo una `editions` sintética propia, para que cuente en H2H,
 * récord de carrera, actividad de temporada, etc. igual que un partido real del tour
 * (docs/decisiones.md, "Finals cuentan como torneos de verdad"). Nunca se toca al
 * revés: nada lee de aquí para pintar el panel de Finals.
 */
const XKT_SOURCE_SLUG = "xkt";

const EVENT_DISPLAY_NAME: Record<string, string> = {
  tour_finals: "Tour Finals",
  next_gen_finals: "Next Gen Finals",
};

async function getOrCreateXktSourceId(): Promise<number> {
  const [existing] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, XKT_SOURCE_SLUG));
  if (existing) return existing.id;
  const [created] = await db
    .insert(sources)
    .values({ slug: XKT_SOURCE_SLUG, name: "XKT World Tour Finals" })
    .returning({ id: sources.id });
  return created.id;
}

// Ni Tour Finals ni Next Gen Finals tienen pista variable por edición — siempre
// indoor, siempre dura, en TE4 igual que en la vida real. "Indoor Concrete" es un
// valor real ya reconocido en todo el sitio (lib/surfaceColors.ts: colorea "Hard" y
// se traduce a "Indoor Hard" en cualquier sitio que lo muestre), así que se fija aquí
// en vez de inventar una etiqueta nueva o dejarlo sin superficie (pedido explícito,
// 2026-09-17: "Finals should look like the other tournaments").
const FINALS_SURFACE = "Indoor Concrete";

/**
 * Idempotente: si esta edición de Finals ya tiene su espejo, se devuelve tal cual. Si
 * no, se crea `events`/`editions` — sin `isoWeek` (no se inventa una fecha), con
 * `drawSize` = participantes activos de verdad en el momento de crear el espejo.
 */
export async function ensureMirroredEdition(finalsEditionId: number): Promise<number> {
  const [fe] = await db.select().from(finalsEditions).where(eq(finalsEditions.id, finalsEditionId));
  if (!fe) throw new Error(`Finals edition ${finalsEditionId} not found`);
  if (fe.mirroredEditionId) return fe.mirroredEditionId;

  const sourceId = await getOrCreateXktSourceId();
  const displayName = EVENT_DISPLAY_NAME[fe.kind] ?? fe.displayName;
  const normalizedName = fe.kind; // 'tour_finals' | 'next_gen_finals' — único y estable por sourceId

  let [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.sourceId, sourceId), eq(events.normalizedName, normalizedName)));
  if (!event) {
    [event] = await db.insert(events).values({ sourceId, normalizedName, displayName }).returning();
  }

  const [{ count: participantCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(finalsParticipants)
    .where(and(eq(finalsParticipants.finalsEditionId, finalsEditionId), eq(finalsParticipants.status, "active")));

  const [edition] = await db
    .insert(editions)
    .values({
      eventId: event.id,
      sourceId,
      externalId: `finals-${fe.kind}-${fe.year}`, // no hay Trn= real, sintético pero único
      year: fe.year,
      isoWeek: null,
      surface: FINALS_SURFACE,
      category: displayName, // "Tour Finals" / "Next Gen Finals" — coincide con lib/tournamentLogos.ts
      competition: "Singles",
      drawSize: participantCount,
    })
    .returning({ id: editions.id });

  await db.update(finalsEditions).set({ mirroredEditionId: edition.id }).where(eq(finalsEditions.id, finalsEditionId));
  return edition.id;
}

/**
 * Espeja UN partido de Finals ya decidido — no hace nada si todavía está `scheduled`
 * (un cruce sin jugar no tiene fila en `matches` tampoco para un torneo real, ver
 * `pending_slots`). Idempotente vía `finals_matches.mirrored_match_id`: la primera
 * vez inserta, las siguientes actualiza la misma fila (p.ej. si se corrige un
 * marcador ya introducido).
 */
export async function syncMirroredMatch(finalsMatchId: number): Promise<void> {
  const [fm] = await db.select().from(finalsMatches).where(eq(finalsMatches.id, finalsMatchId));
  if (!fm) throw new Error(`Finals match ${finalsMatchId} not found`);
  if (!fm.winnerId || fm.outcome === "scheduled" || !fm.player1Id || !fm.player2Id) return;

  const mirroredEditionId = await ensureMirroredEdition(fm.finalsEditionId);

  const seedRows = await db
    .select({ playerId: finalsParticipants.playerId, seed: finalsParticipants.seed })
    .from(finalsParticipants)
    .where(
      and(
        eq(finalsParticipants.finalsEditionId, fm.finalsEditionId),
        inArray(finalsParticipants.playerId, [fm.player1Id, fm.player2Id]),
      ),
    );
  const seedByPlayer = new Map(seedRows.map((r) => [r.playerId, r.seed]));

  const matchValues = {
    editionId: mirroredEditionId,
    round: stageRound(fm),
    player1Id: fm.player1Id,
    player2Id: fm.player2Id,
    player1Seed: seedByPlayer.get(fm.player1Id) ?? null,
    player2Seed: seedByPlayer.get(fm.player2Id) ?? null,
    winnerId: fm.winnerId,
    outcome: fm.outcome,
    scoreRaw: fm.scoreRaw,
    playedAt: fm.playedAt,
  };

  let matchId = fm.mirroredMatchId;
  if (matchId) {
    await db.update(matches).set(matchValues).where(eq(matches.id, matchId));
  } else {
    const [inserted] = await db.insert(matches).values(matchValues).returning({ id: matches.id });
    matchId = inserted.id;
    await db.update(finalsMatches).set({ mirroredMatchId: matchId }).where(eq(finalsMatches.id, finalsMatchId));
  }

  const finalsSetRows = await db.select().from(finalsSets).where(eq(finalsSets.matchId, finalsMatchId));
  await db.delete(sets).where(eq(sets.matchId, matchId));
  if (finalsSetRows.length > 0) {
    await db.insert(sets).values(
      finalsSetRows.map((s) => ({
        matchId: matchId!,
        setNumber: s.setNumber,
        winnerGames: s.winnerGames,
        loserGames: s.loserGames,
        tiebreakLoserPoints: s.tiebreakLoserPoints,
      })),
    );
  }
}

/**
 * Refleja en `pending_slots` — el mismo mecanismo que ya usan los cuadros de Mana y
 * los nativos para pintar un cruce ya emparejado pero sin jugar — el estado actual de
 * `finals_matches` sin decidir. Antes de esto, la ficha pública de una edición de
 * Finals no existía hasta que se decidía el PRIMER partido (`syncMirroredMatch`
 * arriba no hace nada mientras el cruce siga `scheduled`), así que arrancar la fase de
 * grupos no dejaba nada visible en `/tournaments` — bug real reportado (2026-09-17):
 * "debería estar disponible cuando se crea la fase de grupos, los partidos deberían
 * verse aunque no se hayan jugado".
 *
 * Recalcula TODO el pendiente de golpe (borra e inserta) cada vez que se llama, igual
 * que `lib/mana/loadTournament.ts` hace con un cuadro real — más simple que llevar la
 * cuenta incremental de qué añadir o quitar, y evita que un `pending_slot` quede
 * huérfano si un resultado se corrige después de guardado. La Final antes de que
 * ambas semifinales estén decididas se inserta con `player1Id`/`player2Id` a null —
 * `pending_slots` ya soporta ese nulo (bracket real con TBD pendiente de sorteo) y
 * `getBracketMatchesForEdition` ya lo pinta como "TBD" sin cambios.
 *
 * Se llama desde `startGroupStage` (arranca la existencia pública de la edición),
 * `writeMatchResult` y `forceWinMatch` (cada resultado quita su propio cruce de
 * pendiente y puede sembrar semifinales/rellenar la Final con nuevos pendientes).
 */
export async function syncPendingFinalsSlots(finalsEditionId: number): Promise<number> {
  const mirroredEditionId = await ensureMirroredEdition(finalsEditionId);

  const scheduled = await db
    .select()
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.outcome, "scheduled")));

  const seedRows = await db
    .select({ playerId: finalsParticipants.playerId, seed: finalsParticipants.seed })
    .from(finalsParticipants)
    .where(eq(finalsParticipants.finalsEditionId, finalsEditionId));
  const seedByPlayer = new Map(seedRows.map((r) => [r.playerId, r.seed]));

  await db.delete(pendingSlots).where(eq(pendingSlots.editionId, mirroredEditionId));
  if (scheduled.length > 0) {
    await db.insert(pendingSlots).values(
      scheduled.map((fm) => ({
        editionId: mirroredEditionId,
        round: stageRound(fm),
        player1Id: fm.player1Id,
        player2Id: fm.player2Id,
        player1Seed: fm.player1Id ? (seedByPlayer.get(fm.player1Id) ?? null) : null,
        player2Seed: fm.player2Id ? (seedByPlayer.get(fm.player2Id) ?? null) : null,
        sortIndex: fm.id,
      })),
    );
  }
  return mirroredEditionId;
}
