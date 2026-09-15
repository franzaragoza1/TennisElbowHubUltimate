"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, editions, events, players } from "@/db/schema";
import { isAdmin } from "@/lib/adminSession";
import { getCurrentUser } from "@/lib/auth";
import { enhanceNewsContent, type EnhancedNewsContent, type PlayerContext } from "@/lib/newsGeneration/enhance";
import { getRelatedInterviewQuotes } from "@/lib/newsGeneration/relatedInterviews";
import { getRelatedNews } from "@/lib/newsGeneration/relatedNews";
import { getRecentFormLines } from "@/lib/newsGeneration/recentForm";
import { getCurrentRanks } from "@/lib/tourQueries";

export interface EnhanceNewsDraftInput {
  /** null en un artículo nuevo — excluye al propio artículo de "cobertura previa"
   * cuando se está reescribiendo uno ya existente. */
  newsId: number | null;
  title: string;
  category: string;
  editionId: number | null;
  playerIds: number[];
  /** Texto plano ya extraído del editor en el cliente (el propio DOM sobre el HTML
   * vivo, ver useEnhanceNewsDraft.ts) — este action nunca ve el HTML crudo, ni falta
   * que hace: Groq solo necesita la prosa, no el marcado. */
  draftBody: string;
}

export interface EnhanceNewsDraftResult {
  error: string | null;
  content: EnhancedNewsContent | null;
}

/**
 * Sustituye al viejo `generateNewsDrafts` — ver lib/newsGeneration/enhance.ts para el
 * porqué. Quien llama (admin O reportero aprobado, ver el comentario de más abajo) ya
 * decidió título/torneo/jugadores/categoría en su propio formulario
 * (components/admin/NewsForm.tsx / components/account/ReporterStoryForm.tsx); esto
 * solo pide a Groq que pula la prosa y la enriquezca con hechos reales ya existentes
 * en el sitio (cobertura previa, forma reciente, ranking, entrevistas). Nunca guarda
 * nada por su cuenta — quien llama sigue viendo el resultado en su propio formulario y
 * decide si lo guarda.
 *
 * A diferencia de `requireAdmin()` (que redirige), esto devuelve un error normal —
 * `ReporterStoryForm` vive dentro de un flujo de botones/formularios, nunca de una
 * navegación de página, así que un redirect a mitad de sesión sería un salto raro en
 * vez de un mensaje de error entendible.
 */
async function requireReporterOrAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Sign in first.";
  if (await isAdmin(user)) return null;

  const [account] = await db.select({ isReporter: authUsers.isReporter }).from(authUsers).where(eq(authUsers.id, user.id));
  if (account?.isReporter) return null;

  return "Only admins and approved reporters can use this.";
}

export async function enhanceNewsDraft(input: EnhanceNewsDraftInput): Promise<EnhanceNewsDraftResult> {
  const authError = await requireReporterOrAdmin();
  if (authError) return { error: authError, content: null };

  const title = input.title.trim();
  if (!title) return { error: "Add a headline first.", content: null };
  if (!input.draftBody.trim()) {
    return { error: "Write at least a rough draft first — this enhances your draft, it doesn't start from nothing.", content: null };
  }

  const [tournamentRow] = input.editionId
    ? await db
        .select({ eventName: events.displayName, year: editions.year })
        .from(editions)
        .innerJoin(events, eq(events.id, editions.eventId))
        .where(eq(editions.id, input.editionId))
    : [];
  const tournamentLabel = tournamentRow ? `${tournamentRow.eventName} ${tournamentRow.year}` : null;

  const taggedPlayers =
    input.playerIds.length > 0
      ? await db.select({ id: players.id, displayName: players.displayName }).from(players).where(inArray(players.id, input.playerIds))
      : [];

  const now = new Date();
  const [relatedQuotes, relatedNews, ranks, recentFormByPlayer] = await Promise.all([
    getRelatedInterviewQuotes(input.editionId, input.playerIds),
    getRelatedNews(input.newsId, input.editionId, input.playerIds),
    getCurrentRanks(input.playerIds),
    Promise.all(taggedPlayers.map((p) => getRecentFormLines(p.id, now))),
  ]);

  const playerContext: PlayerContext[] = taggedPlayers.map((p, i) => ({
    playerName: p.displayName,
    currentRank: ranks.get(p.id) ?? null,
    recentForm: recentFormByPlayer[i],
  }));

  const content = await enhanceNewsContent({
    title,
    category: input.category,
    tournamentLabel,
    taggedPlayerNames: taggedPlayers.map((p) => p.displayName),
    draftBody: input.draftBody,
    relatedQuotes,
    relatedNews,
    playerContext,
  });

  if (!content) {
    return { error: "The AI couldn't enhance this right now — try again in a moment, or just keep your own draft.", content: null };
  }
  return { error: null, content };
}
