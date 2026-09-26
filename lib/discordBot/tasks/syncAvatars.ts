/**
 * Mantiene al día el avatar de cada jugador vinculado — auth.ts ya lo refresca en cada
 * LOGIN, pero quien cambia su foto de Discord y no vuelve a entrar en la web (la sesión
 * dura 30 días) se queda con una URL vieja que Discord acaba sirviendo como 404 (real,
 * 2026-09-26: fakefederer y lucasamaro, cabecera de la ficha en negro). El bot ya está en
 * el servidor y puede pedirle a Discord el usuario por id, así que lo comprueba aquí.
 *
 * Solo toca jugadores con avatar de Discord (`avatarIsCustom` = false) — nunca pisa una
 * foto subida a mano. Como mucho una pasada cada 6 h (en memoria, el bot es un único
 * proceso de larga vida): unas decenas de peticiones a la API de Discord, no hace falta
 * más a menudo ni conviene hacerlas en cada ciclo de sondeo.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts, authUsers, players } from "@/db/schema";
import { discordAvatarUrl } from "@/lib/discordAvatar";
import { discordClient } from "../client";

const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastRunAt = 0;

export async function syncAvatars(): Promise<void> {
  if (Date.now() - lastRunAt < MIN_INTERVAL_MS) return;
  lastRunAt = Date.now();

  const rows = await db
    .select({
      playerId: players.id,
      userId: players.linkedUserId,
      avatarUrl: players.avatarUrl,
      discordId: authAccounts.providerAccountId,
    })
    .from(players)
    .innerJoin(authAccounts, and(eq(authAccounts.userId, players.linkedUserId), eq(authAccounts.provider, "discord")))
    .where(eq(players.avatarIsCustom, false));

  let updated = 0;
  for (const row of rows) {
    if (!row.userId) continue;
    const user = await discordClient.users.fetch(row.discordId, { force: true }).catch(() => null);
    if (!user) continue;
    const fresh = discordAvatarUrl({ id: user.id, avatar: user.avatar, discriminator: user.discriminator });
    if (fresh === row.avatarUrl) continue;
    await db.update(players).set({ avatarUrl: fresh }).where(eq(players.id, row.playerId));
    await db.update(authUsers).set({ image: fresh }).where(eq(authUsers.id, row.userId));
    updated++;
  }
  if (updated > 0) console.log(`✓ Avatares de Discord actualizados: ${updated}`);
}
