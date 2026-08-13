import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players, rankingSnapshots } from "@/db/schema";
import { RankingTable, type RankingRow } from "@/components/rankings/RankingTable";
import { RankingFilters, type RankedWeek } from "@/components/rankings/RankingFilters";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { getPlayerTotals, getYearRecords } from "@/lib/tourQueries";

export const revalidate = 3600;

const DEFAULT_TOP_N = 100;
const TOP_N_OPTIONS = [50, 100, 200, 500];

async function getAvailableWeeks(): Promise<RankedWeek[]> {
  return db
    .selectDistinct({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
    .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek));
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; top?: string }>;
}) {
  const params = await searchParams;
  const weeks = await getAvailableWeeks();

  if (weeks.length === 0) {
    return (
      <div className="tour-container py-8">
        <p className="text-muted-label">No ranking data loaded yet.</p>
      </div>
    );
  }

  let isoYear = weeks[0].isoYear;
  let isoWeek = weeks[0].isoWeek;
  if (params.week) {
    const [y, w] = params.week.split("-").map(Number);
    if (weeks.some((week) => week.isoYear === y && week.isoWeek === w)) {
      isoYear = y;
      isoWeek = w;
    }
  }

  const topN = Math.min(500, Math.max(10, Number(params.top) || DEFAULT_TOP_N));

  const [rows, totals, yearRecords] = await Promise.all([
    db
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
      .where(and(eq(rankingSnapshots.isoYear, isoYear), eq(rankingSnapshots.isoWeek, isoWeek)))
      .orderBy(asc(rankingSnapshots.rank))
      .limit(topN),
    getPlayerTotals(),
    getYearRecords(isoYear),
  ]);

  const tableRows: RankingRow[] = rows.map((r) => {
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

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Rankings"
        subtitle="Singles · Entry points, imported from the Mana Games Online Tour"
      />
      <div className="tour-container tour-container--medium py-8">
        <RankingFilters
          weeks={weeks}
          currentWeek={{ isoYear, isoWeek }}
          currentTop={topN}
          topOptions={TOP_N_OPTIONS}
        />
        <RankingTable rows={tableRows} />
      </div>
    </div>
  );
}
