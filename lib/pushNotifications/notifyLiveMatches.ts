import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { follows, liveMatchAlerts } from "@/db/schema";
import type { LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";
import { createNotification, markNotificationPushSent } from "@/lib/notifications";
import { sendPushToUser } from "./send";

/**
 * Llamado desde scripts/liveScoresSync.ts en cada ciclo de 20s, con la foto YA
 * resuelta (real + el partido de mentira si `toggleFakeLiveMatch` lo dejó encendido,
 * ver lib/liveTennis/fakeLiveMatch.ts) — nunca decide por sí solo qué está en directo,
 * solo qué partidos de esa foto son NUEVOS de verdad.
 *
 * "Nuevo de verdad" = `INSERT ... ON CONFLICT (dedup_key) DO NOTHING RETURNING *`
 * contra `live_match_alerts` — Postgres solo devuelve las filas que de verdad se
 * insertaron, así que no hace falta guardar "la foto anterior" en memoria (que un
 * reinicio del proceso perdería, ver el comentario de `live_match_alerts` en
 * db/schema.ts).
 *
 * Batching por ciclo (no por partido): un usuario que sigue a dos jugadores que se
 * ponen en directo a la vez recibe UN push, no dos — la bandeja sigue teniendo una
 * fila por partido (`notifications`), solo el envío del push en sí se agrupa.
 */
export async function notifyNewlyLiveMatches(matches: LiveTourMatch[]): Promise<void> {
  if (matches.length === 0) return;

  const inserted = await db
    .insert(liveMatchAlerts)
    .values(
      matches.map((m) => ({
        dedupKey: m.dedupKey,
        player1Id: m.player1.id,
        player2Id: m.player2.id,
        editionId: m.editionId,
      })),
    )
    .onConflictDoNothing()
    .returning({ dedupKey: liveMatchAlerts.dedupKey });

  if (inserted.length === 0) return;

  const newlyLiveKeys = new Set(inserted.map((r) => r.dedupKey));
  const newlyLiveMatches = matches.filter((m) => newlyLiveKeys.has(m.dedupKey));

  // Una sola consulta de `follows` para TODOS los partidos nuevos del ciclo, no una
  // por partido (N+1 real, encontrado en una auditoría de rendimiento, 2026-09-19) —
  // el cruce "qué partido sigue cada fila" se hace después, en memoria, sobre un
  // resultado que en la práctica nunca pasa de un puñado de filas.
  const playerIds = new Set<number>();
  const editionIds = new Set<number>();
  for (const match of newlyLiveMatches) {
    playerIds.add(match.player1.id);
    playerIds.add(match.player2.id);
    if (match.editionId !== null) editionIds.add(match.editionId);
  }

  const targetConditions = [and(eq(follows.targetType, "player"), inArray(follows.targetId, [...playerIds]))];
  if (editionIds.size > 0) {
    targetConditions.push(and(eq(follows.targetType, "edition"), inArray(follows.targetId, [...editionIds])));
  }
  const followerRows = await db
    .select({ userId: follows.userId, targetType: follows.targetType, targetId: follows.targetId })
    .from(follows)
    .where(or(...targetConditions));

  const perUser = new Map<string, LiveTourMatch[]>();

  for (const match of newlyLiveMatches) {
    // Un mismo usuario puede seguir a los dos jugadores del cruce a la vez — sin este
    // Set recibiría dos filas de `notifications` idénticas para el mismo partido.
    const matchFollowerIds = new Set(
      followerRows
        .filter(
          (f) =>
            (f.targetType === "player" && (f.targetId === match.player1.id || f.targetId === match.player2.id)) ||
            (f.targetType === "edition" && f.targetId === match.editionId),
        )
        .map((f) => f.userId),
    );

    for (const userId of matchFollowerIds) {
      const list = perUser.get(userId) ?? [];
      list.push(match);
      perUser.set(userId, list);
    }
  }

  for (const [userId, userMatches] of perUser) {
    const notificationIds: number[] = [];
    for (const match of userMatches) {
      const id = await createNotification({
        userId,
        type: "match_live",
        // Título corto a propósito (solo los nombres) — el sistema operativo corta
        // el título de un push a una sola línea (bug real, reportado con captura:
        // "Ace Ventura vs. Bjorn Bold just we…"), y "just went live" era justo lo que
        // se perdía. El resto vive en `body`, que sí se enseña completo.
        title: `${match.player1.displayName} vs. ${match.player2.displayName}`,
        body: `Just went live — ${match.tournamentName} — ${match.roundLabel}`,
        href: "/scores",
      });
      notificationIds.push(id);
    }

    const payload =
      userMatches.length === 1
        ? {
            title: `${userMatches[0].player1.displayName} vs. ${userMatches[0].player2.displayName}`,
            body: `Just went live — ${userMatches[0].tournamentName} — ${userMatches[0].roundLabel}`,
            href: "/scores",
          }
        : {
            title: `${userMatches.length} of your matches just went live`,
            body: userMatches.map((m) => `${m.player1.displayName} vs. ${m.player2.displayName}`).join(" · "),
            href: "/scores",
          };

    // Sin `await` a propósito (design decision 9 del plan de push notifications): el
    // envío en sí es best-effort encima de las filas de `notifications` ya escritas
    // arriba, y no debe retrasar el resto de usuarios de este mismo ciclo.
    sendPushToUser(userId, payload)
      .then(() => Promise.all(notificationIds.map((id) => markNotificationPushSent(id))))
      .catch(() => {});
  }
}
