import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { CategoryNomineeGroup } from "@/components/awards/CategoryNomineeGroup";
import { PastWinnersList } from "@/components/awards/PastWinnersList";
import { SpeechBlock } from "@/components/awards/SpeechBlock";
import { categoriesForCycle, type AwardCycle } from "@/lib/awards/catalog";
import { discordPollLink } from "@/lib/awards/format";
import { getClosedPeriods, getCurrentVotingPeriod, getNominationsForPeriod, getPeriodResults } from "@/lib/awards/queries";

export default async function AwardsPage() {
  const current = await getCurrentVotingPeriod();

  const [nominations, closedPeriods] = await Promise.all([
    current ? getNominationsForPeriod(current.id, ["approved"]) : Promise.resolve([]),
    getClosedPeriods(5),
  ]);

  const closedResults = await Promise.all(closedPeriods.map(async (period) => ({ period, results: await getPeriodResults(period.id) })));

  const nominationsByCategory = new Map<string, typeof nominations>();
  for (const n of nominations) {
    if (!nominationsByCategory.has(n.categoryKey)) nominationsByCategory.set(n.categoryKey, []);
    nominationsByCategory.get(n.categoryKey)!.push(n);
  }
  const categoriesWithNominees = current ? categoriesForCycle(current.cycle as AwardCycle).filter((c) => (nominationsByCategory.get(c.key)?.length ?? 0) > 0) : [];

  return (
    <div>
      <PageMasthead eyebrow="Tennis Elbow 4 Online Tour" title="Awards" subtitle="Community-voted monthly and yearly awards." />
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {current ? (
            <>
              {current.speech && <SpeechBlock speech={current.speech} />}
              {categoriesWithNominees.map((category) => {
                const nominees = nominationsByCategory.get(category.key) ?? [];
                return (
                  <CategoryNomineeGroup
                    key={category.key}
                    category={category}
                    nominees={nominees}
                    discordLink={discordPollLink(nominees[0]?.discordPollMessageId ?? null)}
                  />
                );
              })}
            </>
          ) : (
            <p className="text-muted-label mb-8 rounded-lg border border-rule bg-paper px-4 py-10 text-center">No poll open right now — check back soon.</p>
          )}

          <h2 className="text-headline mb-4 mt-4 text-lg text-ink">Past winners</h2>
          <PastWinnersList entries={closedResults} />
        </div>
        <Sidebar hide={[]} />
      </div>
    </div>
  );
}
