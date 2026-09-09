import { notFound } from "next/navigation";
import Link from "next/link";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { CategoryNomineeGroup } from "@/components/awards/CategoryNomineeGroup";
import { SpeechBlock } from "@/components/awards/SpeechBlock";
import { categoriesForCycle, type AwardCycle } from "@/lib/awards/catalog";
import { discordPollLink, periodLabel } from "@/lib/awards/format";
import { getAwardPeriod, getNominationsForPeriod, getPeriodResults } from "@/lib/awards/queries";

export default async function AwardPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const { period: periodParam } = await params;
  const periodId = Number(periodParam);
  if (!Number.isInteger(periodId)) notFound();

  const period = await getAwardPeriod(periodId);
  // Un período 'draft' todavía no es público — el admin sigue curando nominados.
  if (!period || period.status === "draft") notFound();

  const isVoting = period.status === "voting";
  const [nominations, results] = await Promise.all([
    isVoting ? getNominationsForPeriod(periodId, ["approved"]) : Promise.resolve([]),
    isVoting ? Promise.resolve(null) : getPeriodResults(periodId),
  ]);

  const nominationsByCategory = new Map<string, typeof nominations>();
  for (const n of nominations) {
    if (!nominationsByCategory.has(n.categoryKey)) nominationsByCategory.set(n.categoryKey, []);
    nominationsByCategory.get(n.categoryKey)!.push(n);
  }
  const resultsByCategory = new Map((results ?? []).map((r) => [r.categoryKey, r]));

  const categories = categoriesForCycle(period.cycle as AwardCycle).filter((c) =>
    isVoting ? (nominationsByCategory.get(c.key)?.length ?? 0) > 0 : resultsByCategory.has(c.key),
  );

  return (
    <div>
      <PageMasthead eyebrow="Tennis Elbow 4 Online Tour" title={periodLabel(period)} subtitle={isVoting ? "Voting open" : "Results"} />
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <Link href="/awards" className="text-eyebrow mb-4 inline-block text-xs text-muted-label hover:text-ink">
            ← All awards
          </Link>
          {period.speech && <SpeechBlock speech={period.speech} />}
          {categories.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">Nothing to show yet.</p>
          ) : (
            categories.map((category) => {
              const nominees = nominationsByCategory.get(category.key) ?? [];
              return (
                <CategoryNomineeGroup
                  key={category.key}
                  category={category}
                  nominees={nominees}
                  results={resultsByCategory.get(category.key)}
                  discordLink={isVoting ? discordPollLink(nominees[0]?.discordPollMessageId ?? null) : null}
                />
              );
            })
          )}
        </div>
        <Sidebar hide={[]} />
      </div>
    </div>
  );
}
