"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, editions, events, players } from "@/db/schema";
import { isAdmin } from "@/lib/adminSession";
import { getCurrentUser } from "@/lib/auth";
import { enhanceNewsContent, type EnhancedNewsContent } from "@/lib/newsGeneration/enhance";
import { getRelatedInterviewQuotes } from "@/lib/newsGeneration/relatedInterviews";

export interface EnhanceNewsDraftInput {
  title: string;
  category: string;
  editionId: number | null;
  playerIds: number[];
  /** Texto plano ya extraído del editor en el cliente (Tiptap `editor.getText()`) —
   * este action nunca ve el HTML crudo, ni falta que hace: Groq solo necesita la
   * prosa, no el marcado. */
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
 * solo pide a Groq que pula la prosa y, si hay entrevistas reales de esos jugadores en
 * ese torneo, teja alguna cita de verdad. Nunca guarda nada por su cuenta — quien
 * llama sigue viendo el resultado en su propio formulario y decide si lo guarda.
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

  const taggedPlayerNames =
    input.playerIds.length > 0
      ? (await db.select({ displayName: players.displayName }).from(players).where(inArray(players.id, input.playerIds))).map((p) => p.displayName)
      : [];

  const relatedQuotes = input.editionId ? await getRelatedInterviewQuotes(input.editionId, input.playerIds) : [];

  const content = await enhanceNewsContent({
    title,
    category: input.category,
    tournamentLabel,
    taggedPlayerNames,
    draftBody: input.draftBody,
    relatedQuotes,
  });

  if (!content) {
    return { error: "The AI couldn't enhance this right now — try again in a moment, or just keep your own draft.", content: null };
  }
  return { error: null, content };
}
