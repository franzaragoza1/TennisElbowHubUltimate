import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players, rankingSnapshots } from "@/db/schema";
import { RankingTable, type RankingRow } from "@/components/rankings/RankingTable";
import { RankingFilters, type RankedWeek } from "@/components/rankings/RankingFilters";
import { RankingViewToggle, type RankingView } from "@/components/rankings/RankingViewToggle";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { getNextGenRaceRanking, getPlayerTotals, getYearRecords } from "@/lib/tourQueries";

export const revalidate = 3600;

const DEFAULT_TOP_N = 100;
const TOP_N_OPTIONS = [50, 100, 200, 500];

async function getAvailableWeeks(kind: "official" | "race"): Promise<RankedWeek[]> {
  return db
    .selectDistinct({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.kind, kind))
    .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek));
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; top?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view: RankingView =
    params.view === "race" ? "race" : params.view === "nextgen" ? "nextgen" : "official";
  // Next Gen Race es un filtro sobre la Race, no un `kind` propio en base de datos —
  // comparte su calendario de semanas (solo la más reciente, ver docs/decisiones.md).
  const weeks = await getAvailableWeeks(view === "official" ? "official" : "race");

  const topN = Math.min(500, Math.max(10, Number(params.top) || DEFAULT_TOP_N));

  let tableRows: RankingRow[] = [];
  let isoYear = 0;
  let isoWeek = 0;
  if (weeks.length > 0) {
    isoYear = weeks[0].isoYear;
    isoWeek = weeks[0].isoWeek;
    // La Race (y Next Gen Race, que la reusa) solo se enseña en su semana más
    // reciente — no tiene el valor histórico de la oficial, así que ni se lee el
    // parámetro `week` para ninguna de las dos.
    if (view === "official" && params.week) {
      const [y, w] = params.week.split("-").map(Number);
      if (weeks.some((week) => week.isoYear === y && week.isoWeek === w)) {
        isoYear = y;
        isoWeek = w;
      }
    }

    const [rows, totals, yearRecords] = await Promise.all([
      view === "nextgen"
        ? getNextGenRaceRanking(topN)
        : db
            .select({
              rank: rankingSnapshots.rank,
              points: rankingSnapshots.points,
              moved: rankingSnapshots.moved,
              playerId: players.id,
              displayName: players.displayName,
              country: players.country,
              character: players.character,
            })
            .from(rankingSnapshots)
            .innerJoin(players, eq(players.id, rankingSnapshots.playerId))
            .where(
              and(
                eq(rankingSnapshots.kind, view),
                eq(rankingSnapshots.isoYear, isoYear),
                eq(rankingSnapshots.isoWeek, isoWeek),
              ),
            )
            .orderBy(asc(rankingSnapshots.rank))
            .limit(topN),
      getPlayerTotals(),
      getYearRecords(isoYear),
    ]);

    tableRows = rows.map((r) => {
      const t = totals.get(r.playerId);
      const y = yearRecords.get(r.playerId);
      return {
        ...r,
        careerHigh: t?.careerHigh ?? null,
        titles: t?.titles ?? 0,
        yearWins: y?.wins ?? 0,
        yearLosses: y?.losses ?? 0,
      };
    });
  }

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Rankings"
        subtitle={
          view === "official"
            ? "Singles · Entry points, imported from the Mana Games Online Tour"
            : view === "race"
              ? "Singles · Points earned this season only, current week — decides who plays the Tour Finals"
              : "Singles · Race points, current week — players with no matches on record before this season"
        }
      />
      <div className="tour-container tour-container--medium py-8">
        <div className="mb-4">
          <RankingViewToggle current={view} extraParams={{ week: params.week, top: params.top }} />
        </div>

        {weeks.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
            {view === "official"
              ? "No ranking data loaded yet."
              : "No Race ranking imported yet — see docs/decisiones.md for how to backfill it."}
          </p>
        ) : view === "nextgen" && tableRows.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
            No debutants in this week&apos;s Race — everyone ranked already has a match on record from a previous season.
          </p>
        ) : (
          <>
            <RankingFilters
              weeks={weeks}
              currentWeek={{ isoYear, isoWeek }}
              currentTop={topN}
              topOptions={TOP_N_OPTIONS}
              showWeekPicker={view === "official"}
            />
            <RankingTable rows={tableRows} highlightFinalsCutoff={view === "race"} />
          </>
        )}
      </div>
    </div>
  );
}
