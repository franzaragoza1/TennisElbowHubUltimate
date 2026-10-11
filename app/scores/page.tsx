import { unstable_cache } from "next/cache";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { CircuitTabs } from "@/components/scores/CircuitTabs";
import { LiveScoresStrip } from "@/components/scores/LiveScoresStrip";
import { TournamentScoresBlock } from "@/components/scores/TournamentScoresBlock";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { getRecentScoresByCircuit } from "@/lib/scoresQueries";
import { CIRCUIT_LABEL, type TournamentCircuit } from "@/lib/tournamentCircuit";
import { getLiveWeek } from "@/lib/liveRanking/liveWeek";

// ISR, no `force-dynamic` (pase de rendimiento, 2026-09-14) — nada en el árbol de esta
// página toca sesión/cookies (ni la propia página ni ningún widget del Sidebar), así
// que no hay motivo real para SSR dinámico. La página tenía además el peor caso
// posible para `force-dynamic`: `<AutoRefresh />` (más abajo) llama a
// `router.refresh()` cada 10 min en cada pestaña abierta mientras haya CUALQUIER
// torneo en curso — con esta página forzada a dinámica, cada uno de esos refrescos
// repetía el join de 5 tablas de `getRecentScoresByCircuit` MÁS las ~6 consultas de
// los widgets del Sidebar, de cero, para cada pestaña, indefinidamente. Los que
// reportan un resultado ya llaman a `revalidatePath("/scores")` al guardar
// (app/admin/scores/actions.ts, app/api/scraper/revalidate/route.ts), así que la
// frescura real no depende de este número — es solo el techo si nadie reporta nada.
export const revalidate = 600;

const CIRCUITS: TournamentCircuit[] = ["tour", "challenger", "future"];

// Esta página lee `searchParams` (circuit) — igual que /players/[id] (mismo comentario
// ahí, 2026-09-14), eso fuerza SSR dinámico SIN caché en absoluto pese al `revalidate`
// de arriba, confirmado midiendo contra un build de producción real. `unstable_cache`
// separa el trabajo caro (el join de 5 tablas + `getLiveWeek()`) del renderizado JSX
// dinámico (barato), memoizado por `circuit` durante `revalidate` segundos.
// `reportedAt` (el único campo `Date` real de `ScoreMatchRow`, que `unstable_cache`
// convertiría en string al pasar por JSON) no se lee en ningún componente de
// components/scores/ — confirmado, no hace falta reconvertirlo al salir de la caché.
const getScoresPageData = unstable_cache(
  async (circuit: TournamentCircuit) => {
    const [blocks, liveWeek] = await Promise.all([getRecentScoresByCircuit(circuit), getLiveWeek()]);
    return { blocks, liveWeek };
  },
  ["scores-page-data"],
  { revalidate: 600 },
);

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ circuit?: string }>;
}) {
  preloadSidebar(["scores"]);
  const params = await searchParams;
  const circuit = CIRCUITS.includes(params.circuit as TournamentCircuit) ? (params.circuit as TournamentCircuit) : "tour";
  const { blocks, liveWeek } = await getScoresPageData(circuit);

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
