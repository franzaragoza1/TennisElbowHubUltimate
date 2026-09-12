/**
 * Reescribe el mention de un jugador en el anuncio de un emparejamiento
 * (announceMatchups.ts) en cuanto vincula su Discord DESPUÉS de que el mensaje ya
 * salió con su nombre en negrita — pedido explícito: alguien que reclama su perfil
 * tarde no debería quedarse para siempre sin ping en un anuncio ya publicado.
 *
 * Recalcula ambos mentions en vivo (lib/playerLinks.ts, la misma fuente de verdad de
 * siempre) y solo reemplaza el trozo `**Nombre**` del contenido ya publicado — nunca
 * reconstruye la cabecera entera (torneo, ronda, plazo...), así que un cambio futuro
 * de formato en announceMatchups.ts no puede desincronizar esta función con él.
 *
 * Sin columna de "ya resuelto": la condición WHERE (al menos un lado todavía sin
 * vincular, y sin resultado ya publicado) deja de encajar sola en cuanto los dos
 * jugadores están vinculados o el partido ya se jugó — la fila simplemente deja de
 * aparecer, igual criterio "derivado, no guardado" que el resto del proyecto.
 */
import { ChannelType } from "discord.js";
import { and, eq, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordMatchResultPosts, discordMatchupThreads, players } from "@/db/schema";
import { resolvePlayerLinks } from "@/lib/playerLinks";
import { discordClient } from "../client";

interface PendingRow {
  channelId: string;
  messageId: string | null; // NOT NULL ya garantizado por el WHERE de findRowsNeedingRefresh
  player1Id: number;
  player1Name: string;
  player1LinkedUserId: string | null;
  player2Id: number;
  player2Name: string;
  player2LinkedUserId: string | null;
}

async function findRowsNeedingRefresh(): Promise<PendingRow[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  return db
    .select({
      channelId: discordMatchupThreads.channelId,
      messageId: discordMatchupThreads.messageId,
      player1Id: p1.id,
      player1Name: p1.displayName,
      player1LinkedUserId: p1.linkedUserId,
      player2Id: p2.id,
      player2Name: p2.displayName,
      player2LinkedUserId: p2.linkedUserId,
    })
    .from(discordMatchupThreads)
    .innerJoin(p1, eq(p1.id, discordMatchupThreads.player1Id))
    .innerJoin(p2, eq(p2.id, discordMatchupThreads.player2Id))
    .where(
      and(
        isNotNull(discordMatchupThreads.messageId),
        or(isNull(p1.linkedUserId), isNull(p2.linkedUserId)),
        // El partido ya se jugó (resultado ya publicado) — el anuncio es historial en
        // ese punto, no vale la pena seguir revisándolo cada ciclo para siempre.
        notExists(
          db
            .select({ one: sql`1` })
            .from(discordMatchResultPosts)
            .where(
              and(
                eq(discordMatchResultPosts.editionId, discordMatchupThreads.editionId),
                eq(discordMatchResultPosts.round, discordMatchupThreads.round),
                eq(discordMatchResultPosts.player1Id, discordMatchupThreads.player1Id),
                eq(discordMatchResultPosts.player2Id, discordMatchupThreads.player2Id),
              ),
            ),
        ),
      ),
    );
}

async function refreshOneRow(row: PendingRow): Promise<void> {
  const channel = await discordClient.channels.fetch(row.channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  // messageId ya se filtró NOT NULL en la consulta — TypeScript no lo sabe porque la
  // columna es nullable a nivel de esquema (filas de antes de este campo).
  const message = await channel.messages.fetch(row.messageId!).catch(() => null);
  if (!message) return; // borrado a mano, o algo raro — nada que editar

  const [links1, links2] = await Promise.all([
    resolvePlayerLinks({ playerId: row.player1Id, linkedUserId: row.player1LinkedUserId }),
    resolvePlayerLinks({ playerId: row.player2Id, linkedUserId: row.player2LinkedUserId }),
  ]);

  let newContent = message.content;
  if (links1.discordUserId) newContent = newContent.replace(`**${row.player1Name}**`, `<@${links1.discordUserId}>`);
  if (links2.discordUserId) newContent = newContent.replace(`**${row.player2Name}**`, `<@${links2.discordUserId}>`);

  if (newContent !== message.content) {
    await message.edit({ content: newContent });
  }
}

export async function updateMatchupMentions(): Promise<void> {
  const rows = await findRowsNeedingRefresh();
  for (const row of rows) {
    try {
      await refreshOneRow(row);
    } catch (err) {
      console.error(`✗ No se pudo refrescar el mention del emparejamiento en el mensaje ${row.messageId}:`, err);
    }
  }
}
