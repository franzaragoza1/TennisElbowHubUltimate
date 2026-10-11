import Image from "next/image";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { getGlobalPredictionLeaderboard, currentPredictionSeason } from "@/lib/predictions/queries";

export const revalidate = 600;

const DASH = "—";

function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? "bg-glow-500/15 text-glow-500 ring-1 ring-glow-500/50" : "text-ink";
  return <span className={`tour-numeric text-headline inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${medal}`}>{rank}</span>;
}

export default async function PredictionRankingsPage() {
  preloadSidebar();
  const rows = await getGlobalPredictionLeaderboard();

  return (
    <div>
      <PageMasthead
        eyebrow={`Bracket Predictions · ${currentPredictionSeason()} Season`}
        title="Predictor Rankings"
        subtitle="Total points across this season's tournament brackets, summed live as results come in. Resets when the season turns over."
      />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
              Nobody has submitted a bracket prediction yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-rule bg-paper shadow-sm">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-paper-tint text-left">
                    <th className="text-eyebrow w-12 px-3 py-3 text-xs text-muted-label sm:w-14">Rank</th>
                    <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Predictor</th>
                    <th className="text-eyebrow hidden w-36 px-3 py-3 text-right text-xs text-muted-label sm:table-cell">
                      Tournaments
                    </th>
                    <th className="text-eyebrow w-24 px-3 py-3 text-right text-xs text-muted-label">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.userId}
                      className="row-reveal h-16 border-b border-rule transition-colors last:border-0 hover:bg-paper-tint"
                      style={{ "--reveal-delay": `${Math.min(i, 20) * 15}ms` } as React.CSSProperties}
                    >
                      <td className="px-3">
                        <RankBadge rank={i + 1} />
                      </td>
                      <td className="px-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {row.userImage ? (
                            <Image src={row.userImage} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" unoptimized />
                          ) : (
                            <span className="h-8 w-8 shrink-0 rounded-full bg-rule" />
                          )}
                          <span className="text-headline truncate text-ink">{row.userName ?? "Anonymous"}</span>
                        </div>
                      </td>
                      <td className="tour-numeric hidden px-3 text-right text-ink sm:table-cell">
                        {row.tournamentsPredicted === 0 ? DASH : row.tournamentsPredicted}
                      </td>
                      <td className="tour-numeric text-headline px-3 text-right text-ink">{row.totalScore.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
