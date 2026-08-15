import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { finalsEditions } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { GroupStandingsTable } from "@/components/finals/GroupStandingsTable";
import { FinalsMatchCard } from "@/components/finals/FinalsMatchCard";
import { FinalsKnockoutBracket } from "@/components/finals/FinalsKnockoutBracket";
import { getGroupMatches, getGroupStandingsRows, getKnockoutMatches } from "@/lib/finals/queries";
import { getFinalsFormat } from "@/lib/finals/format";

export const revalidate = 3600;

export async function generateStaticParams() {
  const rows = await db.select({ id: finalsEditions.id }).from(finalsEditions);
  return rows.map((r) => ({ id: String(r.id) }));
}

const STATUS_LABEL: Record<string, string> = {
  setup: "Setting up",
  groups: "Group stage",
  knockout: "Knockout stage",
  completed: "Completed",
};

export default async function FinalsEditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const finalsEditionId = Number(id);
  if (!Number.isInteger(finalsEditionId)) notFound();

  const [edition] = await db.select().from(finalsEditions).where(eq(finalsEditions.id, finalsEditionId));
  if (!edition) notFound();

  const format = getFinalsFormat(edition.kind);
  const [groupA, groupB, groupAMatches, groupBMatches, knockout] = await Promise.all([
    getGroupStandingsRows(finalsEditionId, "A", format),
    getGroupStandingsRows(finalsEditionId, "B", format),
    getGroupMatches(finalsEditionId, "A"),
    getGroupMatches(finalsEditionId, "B"),
    getKnockoutMatches(finalsEditionId),
  ]);

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.kind === "tour_finals" ? "Tour Finals" : "Next Gen Finals"} · ${edition.year}`}
        title={edition.displayName}
        subtitle={STATUS_LABEL[edition.status] ?? edition.status}
      />

      <div className="tour-container py-8">
        {groupA.length > 0 && (
          <>
            <h2 className="text-headline mb-4 text-lg text-ink">Group Stage</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GroupStandingsTable groupLabel="A" rows={groupA} />
              <GroupStandingsTable groupLabel="B" rows={groupB} />
            </div>

            {(groupAMatches.length > 0 || groupBMatches.length > 0) && (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {[
                  { label: "A", matches: groupAMatches },
                  { label: "B", matches: groupBMatches },
                ].map(({ label, matches }) => (
                  <div key={label} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {matches.map((m) => (
                      <FinalsMatchCard
                        key={m.id}
                        data={{
                          id: m.id,
                          label: `Group ${label}`,
                          player1: m.player1,
                          player2: m.player2,
                          winnerId: m.winnerId,
                          outcome: m.outcome,
                          sets: m.sets,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {knockout.length > 0 && (
          <>
            <h2 className="text-headline mt-10 mb-4 text-lg text-ink">Knockout Stage</h2>
            <FinalsKnockoutBracket
              matches={knockout.map((m) => ({
                id: m.id,
                slot: m.slot,
                label: m.label,
                player1: m.player1,
                player2: m.player2,
                winnerId: m.winnerId,
                outcome: m.outcome,
                sets: m.sets,
              }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
