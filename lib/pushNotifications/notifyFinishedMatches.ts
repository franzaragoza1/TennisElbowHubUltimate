import { and, asc, eq, inArray, isNotNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, finishedMatchPushAlerts, follows, matches, players, recentResults } from "@/db/schema";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { createNotification, markNotificationPushSent } from "@/lib/notifications";
import { sendPushToUser } from "./send";

interface FinishedMatchRow {
  editionId: number;
  round: string;
  drawSize: number;
  eventName: string;
  scoreRaw: string | null;
  outcome: string;
  player1Id: number;
  player1Name: string;
  player2Id: number;
  player2Name: string;
  winnerId: number | null;
}

/**
 * Duplica a propósito la detección de lib/discordBot/tasks/announceResults.ts (mismo
 * criterio de "reportado hace poco Y el torneo sigue en juego o es su propia final",
 * ver el comentario largo de ese fichero) — deduplicado contra su PROPIA tabla
 * (`finished_match_push_alerts`, nunca `discord_match_result_posts`): son dos
 * públicos independientes (un canal de Discord vs. seguidores concretos reales) con
 * reintentos independientes, un fallo avisando a Discord nunca debe bloquear el push
 * push, ni al revés (design decision 8 del plan de push notifications).
 */
async function findUnpushedFinishedMatches(): Promise<FinishedMatchRow[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const otherMatches = alias(matches, "other_matches");

  const rows = await db
    .select({
      editionId: matches.editionId,
      round: matches.round,
      drawSize: editions.drawSize,
      eventName: events.displayName,
      scoreRaw: matches.scoreRaw,
      outcome: matches.outcome,
      player1Id: p1.id,
      player1Name: p1.displayName,
      player2Id: p2.id,
      player2Name: p2.displayName,
      winnerId: matches.winnerId,
      reportedAt: recentResults.reportedAt,
    })
    .from(recentResults)
    .innerJoin(
      matches,
      and(
        eq(matches.editionId, recentResults.editionId),
        eq(matches.round, recentResults.round),
        or(
          and(eq(matches.player1Id, recentResults.winnerId), eq(matches.player2Id, recentResults.loserId)),
          and(eq(matches.player1Id, recentResults.loserId), eq(matches.player2Id, recentResults.winnerId)),
        ),
      ),
    )
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(
      and(
        isNotNull(matches.winnerId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(otherMatches)
            .where(
              and(
                eq(otherMatches.editionId, matches.editionId),
                eq(otherMatches.round, "F"),
                isNotNull(otherMatches.winnerId),
                sql`${otherMatches.id} <> ${matches.id}`,
              ),
            ),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(finishedMatchPushAlerts)
            .where(
              and(
                eq(finishedMatchPushAlerts.editionId, matches.editionId),
                eq(finishedMatchPushAlerts.round, matches.round),
                eq(finishedMatchPushAlerts.player1Id, matches.player1Id),
                eq(finishedMatchPushAlerts.player2Id, matches.player2Id),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(recentResults.reportedAt))
    .limit(30);

  // Mismo motivo que announceResults.ts: más de una fila de `recent_results` puede
  // apuntar al mismo `matches` (reportado dos veces) — se deduplica aquí en JS.
  const seen = new Set<string>();
  const deduped: FinishedMatchRow[] = [];
  for (const row of rows) {
    const key = `${row.editionId}:${row.round}:${row.player1Id}:${row.player2Id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

/**
 * Llamado desde scripts/discordBot.ts::runPollCycle(), justo después de
 * `announceResults()` — mismo ciclo de 15 minutos, ver el comentario de ese fichero.
 * Cada fila se procesa y se marca "ya avisada" por separado (un fallo en una no
 * bloquea las demás, mismo criterio que el propio `announceResults()`), pero el
 * ENVÍO del push se agrupa por usuario al final: si a alguien le terminan dos
 * partidos seguidos que sigue en el mismo ciclo, recibe un push, no dos (design
 * decision 5 del plan).
 */
export async function notifyFollowersOfFinishedMatches(): Promise<void> {
  const rows = await findUnpushedFinishedMatches();
  if (rows.length === 0) return;

  // Una sola consulta de `follows` para TODAS las filas de este ciclo, no una por
  // fila (N+1 real, encontrado en una auditoría de rendimiento, 2026-09-19) — el
  // cruce "quién sigue cada partido" se hace después, en memoria.
  const playerIds = new Set<number>();
  const editionIds = new Set<number>();
  for (const row of rows) {
    playerIds.add(row.player1Id);
    playerIds.add(row.player2Id);
    editionIds.add(row.editionId);
  }
  const followerRows = await db
    .select({ userId: follows.userId, targetType: follows.targetType, targetId: follows.targetId })
    .from(follows)
    .where(
      or(
        and(eq(follows.targetType, "player"), inArray(follows.targetId, [...playerIds])),
        and(eq(follows.targetType, "edition"), inArray(follows.targetId, [...editionIds])),
      ),
    );

  const perUser = new Map<string, { title: string; body: string; href: string; notificationId: number }[]>();

  for (const row of rows) {
    try {
      const winnerIsPlayer1 = row.winnerId === row.player1Id;
      const winnerName = winnerIsPlayer1 ? row.player1Name : row.player2Name;
      const loserName = winnerIsPlayer1 ? row.player2Name : row.player1Name;
      const roundLabel = roundDisplayLabel(fullRoundLadder(row.drawSize), row.round);
      // Título corto (solo los nombres) por el mismo motivo que notifyLiveMatches.ts:
      // el sistema operativo corta el título de un push a una línea, y el marcador
      // era justo lo que se perdía cuando iba en el título. Vive en `body`.
      const title = `${winnerName} d. ${loserName}`;
      const body = `${row.scoreRaw ?? `(${row.outcome})`} — ${row.eventName} — ${roundLabel}`;
      const href = `/tournaments/${row.editionId}`;

      const rowFollowerIds = new Set(
        followerRows
          .filter(
            (f) =>
              (f.targetType === "player" && (f.targetId === row.player1Id || f.targetId === row.player2Id)) ||
              (f.targetType === "edition" && f.targetId === row.editionId),
          )
          .map((f) => f.userId),
      );

      for (const userId of rowFollowerIds) {
        const notificationId = await createNotification({ userId, type: "match_finished", title, body, href });
        const list = perUser.get(userId) ?? [];
        list.push({ title, body, href, notificationId });
        perUser.set(userId, list);
      }

      // Se marca "ya avisada" DESPUÉS de escribir las notificaciones — si esto
      // fallara antes de llegar aquí, el próximo ciclo simplemente lo reintenta
      // (nunca al revés, o quedaría "ya avisada" sin haber avisado a nadie).
      await db.insert(finishedMatchPushAlerts).values({
        editionId: row.editionId,
        round: row.round,
        player1Id: row.player1Id,
        player2Id: row.player2Id,
      });
    } catch (err) {
      console.error(`✗ No se pudo avisar por push el resultado ${row.eventName} ${row.round} (${row.player1Name} vs ${row.player2Name}):`, err);
    }
  }

  for (const [userId, userEvents] of perUser) {
    const payload =
      userEvents.length === 1
        ? { title: userEvents[0].title, body: userEvents[0].body, href: userEvents[0].href }
        : {
            title: `${userEvents.length} of your followed matches just finished`,
            body: userEvents.map((e) => e.title).join(" · "),
            href: "/scores",
          };

    sendPushToUser(userId, payload)
      .then(() => Promise.all(userEvents.map((e) => markNotificationPushSent(e.notificationId))))
      .catch(() => {});
  }
}
