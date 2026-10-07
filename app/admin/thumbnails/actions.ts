"use server";

import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, players } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";

export interface ThumbnailPlayer {
  name: string;
  /** Data URI (`data:image/...;base64,...`), nunca una URL en vivo — el generador
   * exporta la vista previa entera a imagen en el navegador (`html-to-image`), y un
   * `<img>` de otro origen (R2, CDN de Discord) rompería esa exportación por CORS en
   * cuanto el avatar no mandara las cabeceras adecuadas. Convertido aquí, en el
   * servidor, de una vez — nunca se intenta cargar la URL real en el cliente. `null`
   * sin avatar propio (cae a un círculo con iniciales, igual que `PlayerAvatar.tsx`).
   */
  avatarDataUri: string | null;
}

export interface ThumbnailMatchData {
  eventName: string;
  roundLabel: string;
  year: number;
  /** Primero el ganador — mismo criterio de "nominado/ganador primero" ya establecido
   * en el resto del sitio (ver lib/discordBot/tasks/announceAwardsVotingOpened.ts). */
  winner: ThumbnailPlayer;
  loser: ThumbnailPlayer;
}

async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    // Avatar roto/inalcanzable — nunca tumba el generador entero por esto, se cae al
    // círculo de iniciales como si no hubiera avatarUrl en absoluto.
    return null;
  }
}

export async function getMatchThumbnailData(matchId: number): Promise<ThumbnailMatchData | null> {
  await requireAdmin();
  if (!Number.isInteger(matchId)) return null;

  const p1 = alias(players, "thumb_p1");
  const p2 = alias(players, "thumb_p2");
  const [row] = await db
    .select({
      eventName: events.displayName,
      year: editions.year,
      drawSize: editions.drawSize,
      round: matches.round,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player1Name: p1.displayName,
      player1AvatarUrl: p1.avatarUrl,
      player2Id: matches.player2Id,
      player2Name: p2.displayName,
      player2AvatarUrl: p2.avatarUrl,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(eq(matches.id, matchId));
  if (!row) return null;

  const winnerIsP1 = row.winnerId === row.player1Id;
  const winnerRow = winnerIsP1 ? { name: row.player1Name, avatarUrl: row.player1AvatarUrl } : { name: row.player2Name, avatarUrl: row.player2AvatarUrl };
  const loserRow = winnerIsP1 ? { name: row.player2Name, avatarUrl: row.player2AvatarUrl } : { name: row.player1Name, avatarUrl: row.player1AvatarUrl };

  const [winnerAvatar, loserAvatar] = await Promise.all([toDataUri(winnerRow.avatarUrl), toDataUri(loserRow.avatarUrl)]);

  return {
    eventName: row.eventName,
    year: row.year,
    roundLabel: roundDisplayLabel(fullRoundLadder(row.drawSize), row.round),
    winner: { name: winnerRow.name, avatarDataUri: winnerAvatar },
    loser: { name: loserRow.name, avatarDataUri: loserAvatar },
  };
}
