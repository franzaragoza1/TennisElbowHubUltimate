import { PageMasthead } from "@/components/layout/PageMasthead";
import { CircuitTabs } from "@/components/scores/CircuitTabs";
import { LiveScoresStrip } from "@/components/scores/LiveScoresStrip";
import { TournamentScoresBlock } from "@/components/scores/TournamentScoresBlock";
import { getRecentScoresByCircuit } from "@/lib/scoresQueries";
import { CIRCUIT_LABEL, type TournamentCircuit } from "@/lib/tournamentCircuit";

export const dynamic = "force-dynamic";

const CIRCUITS: TournamentCircuit[] = ["tour", "challenger", "future"];

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ circuit?: string }>;
}) {
  const params = await searchParams;
  const circuit = CIRCUITS.includes(params.circuit as TournamentCircuit) ? (params.circuit as TournamentCircuit) : "tour";
  const blocks = await getRecentScoresByCircuit(circuit);

  return (
    <div>
      <PageMasthead eyebrow="Tennis Elbow 4 Online Tour" title="Scores" subtitle="Most recently reported results, by tournament" />

      <LiveScoresStrip />

      <div className="tour-container pt-6">
        <CircuitTabs current={circuit} />
      </div>

      <div className="tour-container py-8">
        {blocks.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-12 text-center text-sm">
            No results reported for {CIRCUIT_LABEL[circuit]} recently.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {blocks.map((block) => (
              <TournamentScoresBlock key={block.editionId} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
