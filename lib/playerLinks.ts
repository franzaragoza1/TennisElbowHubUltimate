/**
 * Enlaces reales de un jugador — a su propia ficha en este sitio, a su perfil en el
 * foro de Mana Games (si tiene un alias registrado) y a su Discord (si tiene cuenta
 * vinculada). Extraído de `lib/nextOpponent.ts::resolveOpponentInfo` (donde vivía sin
 * exportarse) porque el bot de Discord necesita exactamente lo mismo para sus embeds
 * — nunca se inventa un enlace para quien no lo tiene, cada campo puede salir `null`.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts, playerAliases, sources } from "@/db/schema";
import { manaPlayerUrl } from "@/lib/mana/links";

export interface PlayerProfileLinks {
  websiteProfileUrl: string;
  /** null = sin alias de Mana Games registrado para este jugador (p.ej. un perfil
   * creado a mano desde /account, nunca importado del foro). */
  manaProfileUrl: string | null;
  /** null = sin cuenta de Discord vinculada. */
  discordProfileUrl: string | null;
  /** Mismo dato que `discordProfileUrl` pero como snowflake en bruto — hace falta para
   * un mention `<@id>` de verdad (el bot de Discord), no solo un enlace de texto. */
  discordUserId: string | null;
}

export interface PlayerLinksInput {
  playerId: number;
  linkedUserId: string | null;
}

/** Sin barra final — quien lo use pega `/players/<id>` directamente. Vacío (no
 * `SITE_URL` configurado) da una URL relativa; a quien le haga falta absoluta de
 * verdad (el bot, para un embed) le toca comprobarlo antes de usarla. */
function siteBaseUrl(): string {
  return (process.env.SITE_URL ?? "").replace(/\/+$/, "");
}

export async function resolvePlayerLinks({ playerId, linkedUserId }: PlayerLinksInput): Promise<PlayerProfileLinks> {
  const [[manaAlias], discordAccount] = await Promise.all([
    db
      .select({ externalId: playerAliases.externalId })
      .from(playerAliases)
      .innerJoin(sources, eq(sources.id, playerAliases.sourceId))
      .where(and(eq(playerAliases.playerId, playerId), eq(sources.slug, "mana")))
      .limit(1),
    linkedUserId
      ? db
          .select({ providerAccountId: authAccounts.providerAccountId })
          .from(authAccounts)
          .where(and(eq(authAccounts.userId, linkedUserId), eq(authAccounts.provider, "discord")))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);

  return {
    websiteProfileUrl: `${siteBaseUrl()}/players/${playerId}`,
    manaProfileUrl: manaAlias ? manaPlayerUrl(manaAlias.externalId) : null,
    discordProfileUrl: discordAccount ? `https://discord.com/users/${discordAccount.providerAccountId}` : null,
    discordUserId: discordAccount?.providerAccountId ?? null,
  };
}
