import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { recentResults, players, liveScoresCache } from "@/db/schema";
import { RefreshScoresButton } from "@/components/admin/scores/RefreshScoresButton";
import { FakeLiveMatchToggle } from "@/components/admin/scores/FakeLiveMatchToggle";
import { VoidRecentResultButton } from "@/components/admin/scores/VoidRecentResultButton";
import { ScrapeRequestsPanel } from "@/components/admin/ScrapeRequestsPanel";
import { FAKE_LIVE_MATCH_TOURNAMENT_NAME } from "@/lib/liveTennis/fakeLiveMatch";
import type { LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

/** Antes app/admin/(panel)/scores/page.tsx — absorbido dentro de /account, ver
 * components/account/AdminSection.tsx. */
export async function ScoresSection() {
  const w = alias(players, "w");
  const l = alias(players, "l");
  const recent = await db
    .select({
      id: recentResults.id,
      reportedAt: recentResults.reportedAt,
      tournamentName: recentResults.tournamentName,
      round: recentResults.round,
      scoreRaw: recentResults.scoreRaw,
      winnerName: w.displayName,
      loserName: l.displayName,
      editionId: recentResults.editionId,
    })
    .from(recentResults)
    .innerJoin(w, eq(recentResults.winnerId, w.id))
    .innerJoin(l, eq(recentResults.loserId, l.id))
    .orderBy(desc(recentResults.reportedAt))
    .limit(20);

  const [liveCacheRow] = await db.select({ matches: liveScoresCache.matches }).from(liveScoresCache).where(eq(liveScoresCache.id, 1));
  const fakeLiveMatchEnabled = ((liveCacheRow?.matches ?? []) as LiveTourMatch[]).some((m) => m.tournamentName === FAKE_LIVE_MATCH_TOURNAMENT_NAME);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline text-2xl text-ink">Scores</h1>
          <p className="text-muted-label text-xs">
            Refreshes OT_LastResults.php and stores newly reported results — safe to run repeatedly, already-known
            results are skipped.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FakeLiveMatchToggle initialEnabled={fakeLiveMatchEnabled} />
          <RefreshScoresButton />
        </div>
      </div>

      <ScrapeRequestsPanel kind="scores" />

      <section className="mt-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Recently reported</h2>
        {recent.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            Nothing loaded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0"
              >
                <span className="text-ink">
                  {r.winnerName} d. {r.loserName} <span className="text-muted-label">({r.scoreRaw})</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-label text-xs">
                    {r.tournamentName} · {r.round} · {!r.editionId && "unlinked · "}
                    {new Date(r.reportedAt).toLocaleString()}
                  </span>
                  <VoidRecentResultButton resultId={r.id} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
