/**
 * Carga puntual de UN torneo, en vivo, para el botón "Add tournament" del panel de
 * admin — hermano pequeño de `scripts/load.ts` (que relee HTML ya archivado en disco
 * en bloque). A diferencia del cargador masivo, este SÍ crea la edición cuando todavía
 * no tiene ningún partido (torneo en inscripción, "Main Draw" ausente): el cargador
 * masivo lo trata como error porque viene del archivo histórico, donde un torneo sin
 * jugar carece de interés; aquí es justo el caso que se quiere poder añadir (CLAUDE.md
 * no lo pedía, pero un torneo recién abierto en el foro es tan real como uno acabado).
 */
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, matches, sets, byes, pendingSlots, editionRoundPoints, editionRoundDeadlines, importRuns, tournamentRegistrationQueue } from "@/db/schema";
import { parseTournamentPage } from "@/parsers/tournamentPage";
import { ensureSource, loadPlayerMap, ensurePlayers, loadEventMap, ensureEvents, normalizeEventName } from "./loaders";
import { deriveTournamentStatus, type TournamentStatus } from "@/lib/tournamentStatus";
import { announceNewTournamentRegistrationOpen } from "@/lib/discordBot/tasks/announceNewTournament";
import { matchKey, pendingKey, planReconcile } from "./reconcile";
export { parseTrnInput } from "./trn";

export interface LoadTournamentResult {
  editionId: number;
  eventName: string;
  year: number;
  isoWeek: number | null;
  status: TournamentStatus;
  matchCount: number;
  wasNewEdition: boolean;
}

export async function loadTournamentByExternalId(
  externalId: string,
  options?: { headless?: boolean },
): Promise<LoadTournamentResult> {
  const sourceId = await ensureSource();
  const startedAt = new Date();

  try {
    // Import perezoso a propósito (2026-08-17, docs/decisiones.md): `./fetchLive`
    // carga `playwright`, que solo existe para correr en local — un `import` normal
    // arriba del fichero cargaría ese módulo entero (y con él `playwright`) en cuanto
    // alguien importe `loadTournamentByExternalId`, aunque nunca llegue a invocarse.
    // Con `/admin/tournaments` dando 500 en producción, esto asegura que ni siquiera
    // ENTRAR en la página toca `playwright` — solo pulsar "Add tournament" de verdad.
    const { fetchTournamentPageLive } = await import("./fetchLive");
    const { html } = await fetchTournamentPageLive(externalId, options?.headless);
    const page = parseTournamentPage(html, externalId);

    const playerRefs = new Map<string, string>();
    for (const m of page.matches) {
      playerRefs.set(m.player1.externalId, m.player1.displayName);
      playerRefs.set(m.player2.externalId, m.player2.displayName);
    }
    for (const b of page.byes) {
      playerRefs.set(b.player.externalId, b.player.displayName);
    }
    for (const p of page.pending) {
      if (p.player1) playerRefs.set(p.player1.externalId, p.player1.displayName);
      if (p.player2) playerRefs.set(p.player2.externalId, p.player2.displayName);
    }
    const playerMap = await loadPlayerMap(sourceId);
    await ensurePlayers(sourceId, playerRefs, playerMap);

    const normalizedName = normalizeEventName(page.edition.eventName);
    const eventMap = await loadEventMap(sourceId);
    await ensureEvents(sourceId, new Map([[normalizedName, page.edition.eventName]]), eventMap);
    const eventEntry = eventMap.get(normalizedName)!;

    const existing = await db
      .select({ id: editions.id })
      .from(editions)
      .where(and(eq(editions.sourceId, sourceId), eq(editions.externalId, externalId)));
    const wasNewEdition = existing.length === 0;

    const [editionRow] = await db
      .insert(editions)
      .values({
        eventId: eventEntry.id,
        sourceId,
        externalId,
        year: page.edition.year,
        isoWeek: page.edition.isoWeek,
        weekStartDate: page.edition.weekStartDate,
        surface: page.edition.surface,
        category: page.edition.category,
        competition: page.edition.competition,
        drawSize: page.edition.drawSize,
        queueCount: page.edition.queueCount,
        queueCapacity: page.edition.queueCapacity,
        seeds: page.edition.seeds,
        officialTopicUrl: page.edition.officialTopicUrl,
      })
      .onConflictDoUpdate({
        target: [editions.sourceId, editions.externalId],
        set: {
          eventId: sql`excluded.event_id`,
          year: sql`excluded.year`,
          isoWeek: sql`excluded.iso_week`,
          weekStartDate: sql`excluded.week_start_date`,
          surface: sql`excluded.surface`,
          category: sql`excluded.category`,
          competition: sql`excluded.competition`,
          drawSize: sql`excluded.draw_size`,
          queueCount: sql`excluded.queue_count`,
          queueCapacity: sql`excluded.queue_capacity`,
          seeds: sql`excluded.seeds`,
          officialTopicUrl: sql`excluded.official_topic_url`,
        },
      })
      .returning({ id: editions.id });

    // El torneo puede haber avanzado desde la última carga (más rondas jugadas) o, más raro,
    // haberse corregido un resultado. Antes se BORRABA todo y se volvía a insertar: cada
    // partido recibía un id nuevo en cada pasada (cada 10 min) y con el borrado se iban en
    // cascada sus estadísticas de MatchLog, las previews de los huecos pendientes y los
    // enlaces de vídeos/premios (2026-10-17, ver docs/decisiones.md y lib/mana/reconcile.ts).
    // Ahora partidos y huecos se actualizan en su sitio (mismo id), y todo va en UNA
    // transacción: la web nunca ve el cuadro a medio escribir.
    const editionId = editionRow.id;
    const pid = (externalPlayerId: string) => playerMap.get(externalPlayerId)!.playerId;
    await db.transaction(async (tx) => {
      // ---- partidos
      const existingMatches = await tx
        .select({ id: matches.id, round: matches.round, player1Id: matches.player1Id, player2Id: matches.player2Id })
        .from(matches)
        .where(eq(matches.editionId, editionId));
      const matchPlan = planReconcile(
        existingMatches,
        page.matches,
        (e) => matchKey(e.round, e.player1Id, e.player2Id),
        (m) => matchKey(m.round, pid(m.player1.externalId), pid(m.player2.externalId)),
      );
      const matchValues = (m: (typeof page.matches)[number]) => ({
        editionId,
        round: m.round,
        player1Id: pid(m.player1.externalId),
        player2Id: pid(m.player2.externalId),
        player1Seed: m.player1.seed ?? null,
        player2Seed: m.player2.seed ?? null,
        winnerId: pid(m.winnerExternalId),
        outcome: m.outcome,
        scoreRaw: m.scoreRaw,
        sortIndex: m.sortIndex,
      });
      if (matchPlan.deletes.length > 0) {
        await tx.delete(matches).where(inArray(matches.id, matchPlan.deletes.map((d) => d.id)));
      }
      const withIds: { id: number; m: (typeof page.matches)[number] }[] = [];
      for (const { existing, incoming } of matchPlan.updates) {
        await tx.update(matches).set(matchValues(incoming)).where(eq(matches.id, existing.id));
        withIds.push({ id: existing.id, m: incoming });
      }
      if (matchPlan.inserts.length > 0) {
        const inserted = await tx.insert(matches).values(matchPlan.inserts.map(matchValues)).returning({ id: matches.id });
        matchPlan.inserts.forEach((m, i) => withIds.push({ id: inserted[i].id, m }));
      }
      // los sets no tienen nada colgando: se reescriben los de los partidos de la página
      if (withIds.length > 0) {
        await tx.delete(sets).where(inArray(sets.matchId, withIds.map((w) => w.id)));
        const setRows = withIds.flatMap(({ id, m }) =>
          m.sets.map((st) => ({
            matchId: id,
            setNumber: st.setNumber,
            winnerGames: st.winnerGames,
            loserGames: st.loserGames,
            tiebreakLoserPoints: st.tiebreakLoserPoints,
          })),
        );
        if (setRows.length > 0) await tx.insert(sets).values(setRows);
      }

      // ---- huecos pendientes (las previews cuelgan de su id)
      const existingPending = await tx
        .select({ id: pendingSlots.id, round: pendingSlots.round, sortIndex: pendingSlots.sortIndex })
        .from(pendingSlots)
        .where(eq(pendingSlots.editionId, editionId));
      const pendingPlan = planReconcile(
        existingPending,
        page.pending,
        (e) => pendingKey(e.round, e.sortIndex),
        (p) => pendingKey(p.round, p.sortIndex),
      );
      const pendingValues = (p: (typeof page.pending)[number]) => ({
        editionId,
        round: p.round,
        player1Id: p.player1 ? pid(p.player1.externalId) : null,
        player2Id: p.player2 ? pid(p.player2.externalId) : null,
        player1Seed: p.player1?.seed ?? null,
        player2Seed: p.player2?.seed ?? null,
        player1QualifierNumber: p.player1QualifierNumber,
        player2QualifierNumber: p.player2QualifierNumber,
        sortIndex: p.sortIndex,
      });
      if (pendingPlan.deletes.length > 0) {
        await tx.delete(pendingSlots).where(inArray(pendingSlots.id, pendingPlan.deletes.map((d) => d.id)));
      }
      for (const { existing, incoming } of pendingPlan.updates) {
        await tx.update(pendingSlots).set(pendingValues(incoming)).where(eq(pendingSlots.id, existing.id));
      }
      if (pendingPlan.inserts.length > 0) await tx.insert(pendingSlots).values(pendingPlan.inserts.map(pendingValues));

      // ---- el resto no tiene nada colgando: se reemplaza entero (dentro de la transacción)
      await tx.delete(byes).where(eq(byes.editionId, editionId));
      await tx.delete(editionRoundPoints).where(eq(editionRoundPoints.editionId, editionId));
      await tx.delete(editionRoundDeadlines).where(eq(editionRoundDeadlines.editionId, editionId));
      await tx.delete(tournamentRegistrationQueue).where(eq(tournamentRegistrationQueue.editionId, editionId));

      // Bug real reportado, 2026-10-03: el ranking en vivo no sumaba NADA a jugadores en
      // pleno torneo porque este cargador nunca escribía `edition_round_points` (ver
      // lib/liveRanking/securedPoints.ts).
      if (page.roundPoints.length > 0) {
        await tx.insert(editionRoundPoints).values(page.roundPoints.map((rp) => ({ editionId, round: rp.round, points: rp.points })));
      }

      if (page.byes.length > 0) {
        await tx.insert(byes).values(
          page.byes.map((b) => ({ editionId, round: b.round, playerId: pid(b.player.externalId), seed: b.player.seed ?? null, sortIndex: b.sortIndex })),
        );
      }

      // Solo si el torneo tiene interés real de registro (`Queue: N/M` con N > 0) — pedido
      // explícito, 2026-09-18 (un torneo recién creado enseña nombres sueltos con
      // `Queue: 0/180`). Nunca se crea un jugador solo por inscribirse (`playerId: null`).
      if (page.edition.queueCount !== null && page.edition.queueCount > 0 && page.registrationQueue.length > 0) {
        await tx.insert(tournamentRegistrationQueue).values(
          page.registrationQueue.map((entry) => ({
            editionId,
            playerId: playerMap.get(entry.player.externalId)?.playerId ?? null,
            externalId: entry.player.externalId,
            displayName: entry.player.displayName,
            rank: entry.rank,
            location: entry.location,
            posts: entry.posts,
            sortIndex: entry.sortIndex,
          })),
        );
      }

      // Solo un torneo TODAVÍA en juego trae esta fila en el HTML fuente (uno completado da
      // `roundDeadlines: []`), así que esto nunca escribe plazos obsoletos.
      if (page.roundDeadlines.length > 0) {
        await tx.insert(editionRoundDeadlines).values(page.roundDeadlines.map((rd) => ({ editionId, round: rd.round, deadlineAt: new Date(rd.deadlineAt) })));
      }
    });

    await db.insert(importRuns).values({
      sourceId,
      kind: "tournament",
      startedAt,
      finishedAt: new Date(),
      status: "success",
      filesProcessed: 1,
      rowsInserted: page.matches.length + page.byes.length + page.pending.length,
      rowsSkipped: 0,
    });

    const status = deriveTournamentStatus(page.matches, page.matches.length + page.byes.length + page.pending.length > 0);

    // Solo al descubrir una edición NUEVA que todavía está en inscripción — nunca al
    // refrescar una ya conocida (se recarga el mismo torneo muchas veces mientras
    // está en juego, ver scripts/autoScrape.ts) ni una vez el cuadro ya existe (eso ya
    // no es "se abrió inscripción", es otra cosa). Aparte en su propio try/catch —
    // mismo criterio que el resto del bot: un fallo avisando por Discord nunca debe
    // hacer fallar la carga real del torneo.
    if (wasNewEdition && status === "registration") {
      try {
        await announceNewTournamentRegistrationOpen(editionRow.id);
      } catch (err) {
        console.error(`✗ No se pudo anunciar la apertura de inscripción de Trn=${externalId}:`, err);
      }
    }

    return {
      editionId: editionRow.id,
      eventName: page.edition.eventName,
      year: page.edition.year,
      isoWeek: page.edition.isoWeek,
      status,
      matchCount: page.matches.length,
      wasNewEdition,
    };
  } catch (err) {
    await db.insert(importRuns).values({
      sourceId,
      kind: "tournament",
      startedAt,
      finishedAt: new Date(),
      status: "failed",
      filesProcessed: 0,
      rowsInserted: 0,
      rowsSkipped: 1,
      errors: [{ file: `Trn=${externalId}`, message: err instanceof Error ? err.message : String(err) }],
    });
    throw err;
  }
}
