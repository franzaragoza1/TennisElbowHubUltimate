"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { news, newsPlayers } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import {
  detectChampions,
  detectRankingMilestones,
  detectTitleMilestones,
  detectUpsets,
  detectWinStreaks,
  type NewsFactCandidate,
} from "@/lib/newsGeneration/facts";
import { draftNewsStory } from "@/lib/newsGeneration/draft";

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string, taken: Set<string>): Promise<string> {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export interface DetectorSummary {
  kind: string;
  label: string;
  candidates: number;
  alreadyExisting: number;
  drafted: number;
  failedGuardrail: number;
}

export interface GenerateNewsSummary {
  detectors: DetectorSummary[];
  totalDrafted: number;
}

const DETECTOR_LABELS: Record<NewsFactCandidate["kind"], string> = {
  champion_crowned: "Champion crowned",
  title_milestone: "Title milestone",
  upset: "Upset",
  win_streak: "Win streak",
  ranking_milestone: "Ranking milestone",
};

/**
 * Corre los cinco detectores (lib/newsGeneration/facts.ts) sobre lo importado desde
 * `daysBack` días, y para cada hecho nuevo (no visto ya vía `news.auto_key`) pide un
 * borrador a Groq (lib/newsGeneration/draft.ts). Todo entra como `status: 'draft'` —
 * nunca se publica solo. Disparado a mano desde el panel, no hay cron.
 */
export async function generateNewsDrafts(daysBack: number): Promise<GenerateNewsSummary> {
  await requireAdmin();

  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const [champions, titleMilestones, upsets, winStreaks, rankingMilestones] = await Promise.all([
    detectChampions(sinceDate),
    detectTitleMilestones(sinceDate),
    detectUpsets(sinceDate),
    detectWinStreaks(sinceDate),
    detectRankingMilestones(),
  ]);

  const byKind: Record<NewsFactCandidate["kind"], NewsFactCandidate[]> = {
    champion_crowned: champions,
    title_milestone: titleMilestones,
    upset: upsets,
    win_streak: winStreaks,
    ranking_milestone: rankingMilestones,
  };

  const allCandidates = Object.values(byKind).flat();
  const existingAutoKeys = new Set(
    allCandidates.length > 0
      ? (await db.select({ autoKey: news.autoKey }).from(news).where(inArray(news.autoKey, allCandidates.map((c) => c.autoKey))))
          .map((r) => r.autoKey)
          .filter((k): k is string => k !== null)
      : [],
  );
  const takenSlugs = new Set((await db.select({ slug: news.slug }).from(news)).map((r) => r.slug));

  const summaries: DetectorSummary[] = [];
  let totalDrafted = 0;
  // El plan gratuito de Groq limita a 30 peticiones/minuto por modelo — con hasta un
  // centenar de candidatos en una tanda, lanzarlas todas seguidas revienta el límite y
  // TODAS las siguientes vuelven 429 (indistinguible de un rechazo del guardrail sin
  // este espaciado). 2.2s de margen deja ~27/min, por debajo del tope real.
  const GROQ_CALL_SPACING_MS = 2200;
  let calledGroqOnce = false;

  for (const [kind, candidates] of Object.entries(byKind) as [NewsFactCandidate["kind"], NewsFactCandidate[]][]) {
    let alreadyExisting = 0;
    let drafted = 0;
    let failedGuardrail = 0;

    for (const facts of candidates) {
      if (existingAutoKeys.has(facts.autoKey)) {
        alreadyExisting++;
        continue;
      }

      if (calledGroqOnce) await new Promise((resolve) => setTimeout(resolve, GROQ_CALL_SPACING_MS));
      calledGroqOnce = true;

      const draft = await draftNewsStory(facts);
      if (!draft) {
        failedGuardrail++;
        continue;
      }

      const slug = await uniqueSlug(slugify(draft.title), takenSlugs);
      takenSlugs.add(slug);

      const [inserted] = await db
        .insert(news)
        .values({
          slug,
          title: draft.title,
          excerpt: draft.excerpt,
          body: draft.body,
          category: draft.category,
          editionId: draft.editionId,
          status: "draft",
          autoKey: facts.autoKey,
        })
        .onConflictDoNothing({ target: news.autoKey })
        .returning({ id: news.id });

      if (!inserted) {
        // Otro proceso lo insertó entre el chequeo y aquí — no cuenta como fallo.
        alreadyExisting++;
        continue;
      }

      if (draft.taggedPlayerIds.length > 0) {
        await db.insert(newsPlayers).values(draft.taggedPlayerIds.map((playerId) => ({ newsId: inserted.id, playerId })));
      }
      drafted++;
      totalDrafted++;
    }

    summaries.push({
      kind,
      label: DETECTOR_LABELS[kind],
      candidates: candidates.length,
      alreadyExisting,
      drafted,
      failedGuardrail,
    });
  }

  if (totalDrafted > 0) {
    revalidatePath("/admin");
    revalidatePath("/admin/news/generate");
  }

  return { detectors: summaries, totalDrafted };
}
