import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { CircuitTabs } from "@/components/scores/CircuitTabs";
import { LiveScoresStrip } from "@/components/scores/LiveScoresStrip";
import { TournamentScoresBlock } from "@/components/scores/TournamentScoresBlock";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { getRecentScoresByCircuit } from "@/lib/scoresQueries";
import { CIRCUIT_LABEL, type TournamentCircuit } from "@/lib/tournamentCircuit";
import { getLiveWeek } from "@/lib/liveRanking/liveWeek";

export const dynamic = "force-dynamic";

const CIRCUITS: TournamentCircuit[] = ["tour", "challenger", "future"];

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ circuit?: string }>;
}) {
  const params = await searchParams;
  const circuit = CIRCUITS.includes(params.circuit as TournamentCircuit) ? (params.circuit as TournamentCircuit) : "tour";
  const [blocks, liveWeek] = await Promise.all([getRecentScoresByCircuit(circuit), getLiveWeek()]);

  return (
    <div>
      {/* Solo si hay algún torneo en juego ahora mismo — sin nada en curso no hay
       * marcador nuevo que pueda llegar, refrescar cada 10 min sería tráfico de
       * balde (pedido explícito del propietario). */}
      {liveWeek !== null && <AutoRefresh />}
      <PageMasthead eyebrow="Tennis Elbow 4 Online Tour" title="Scores" subtitle="Most recently reported results, by tournament" />

      <LiveScoresStrip />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-6">
            <CircuitTabs current={circuit} />
          </div>
          {blocks.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-12 text-center text-sm">
              No results reported for {CIRCUIT_LABEL[circuit]} recently.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {blocks.map((block) => (
                <TournamentScoresBlock key={block.editionId} block={block} />
              ))}
            </div>
          )}
        </div>
        <Sidebar hide={["scores"]} />
      </div>
    </div>
  );
}
