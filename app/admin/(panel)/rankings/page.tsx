import { getLatestRankingWeek, getLatestRaceWeek } from "@/lib/tourQueries";
import { RefreshRankingsButton } from "@/components/admin/rankings/RefreshRankingsButton";

export const dynamic = "force-dynamic";

export default async function AdminRankingsPage() {
  const [official, race] = await Promise.all([getLatestRankingWeek(), getLatestRaceWeek()]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-headline text-2xl text-ink">Rankings</h1>
          <p className="text-muted-label text-xs">
            Checks OT_Rankings.php for weeks published since the last import and loads whatever is new — safe to run
            repeatedly, already-imported weeks are skipped.
          </p>
        </div>
        <RefreshRankingsButton />
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-paper">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3 text-sm last:border-0">
          <span className="text-ink">Official</span>
          <span className="text-muted-label text-xs">
            {official ? `${official.isoYear} · Week ${official.isoWeek}` : "Nothing imported yet"}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-ink">Race</span>
          <span className="text-muted-label text-xs">
            {race ? `${race.isoYear} · Week ${race.isoWeek}` : "Nothing imported yet"}
          </span>
        </div>
      </div>
    </div>
  );
}
