import Link from "next/link";
import { getAwardCategory } from "@/lib/awards/catalog";
import { periodLabel } from "@/lib/awards/format";
import type { AwardPeriodRow, CategoryResult, NominationDisplay } from "@/lib/awards/queries";

/** El ganador de la categoría, con cada jugador enlazado a su ficha — un solo
 * nominado (playerId) o, sin uno (nomineeKind 'match', ver lib/awards/catalog.ts), los
 * dos jugadores del partido ganador vía matchDetail (ganador primero: mismo criterio
 * que lib/discordBot/tasks/announceAwardsVotingOpened.ts::winnerFirstMatchLabel, no el
 * orden arbitrario de player1/player2 de matchLabel). */
function WinnerCell({ winner }: { winner: NominationDisplay & { voteCount: number } }) {
  if (winner.playerId && winner.playerName) {
    return (
      <Link href={`/players/${winner.playerId}`} className="hover:underline">
        {winner.playerName}
      </Link>
    );
  }
  if (winner.matchDetail) {
    const { winner: w, loser: l } = winner.matchDetail;
    return (
      <>
        <Link href={`/players/${w.id}`} className="hover:underline">
          {w.displayName}
        </Link>
        {" vs "}
        <Link href={`/players/${l.id}`} className="hover:underline">
          {l.displayName}
        </Link>
      </>
    );
  }
  return <>—</>;
}

export function PastWinnersList({ entries }: { entries: { period: AwardPeriodRow; results: CategoryResult[] }[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">No past winners yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map(({ period, results }) => (
        <div key={period.id} className="rounded-lg border border-rule bg-paper p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-headline text-2xl text-ink">{periodLabel(period)}</h3>
            <Link href={`/awards/${period.id}`} className="text-eyebrow text-xs text-blue-500 hover:underline">
              Full results →
            </Link>
          </div>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {results
                .filter((r) => r.winner !== null)
                .map((r) => {
                  const category = getAwardCategory(r.categoryKey);
                  return (
                    <tr key={r.categoryKey} className="border-t border-rule first:border-t-0">
                      <td className="text-headline py-2 pr-4 text-base text-ink">
                        <span className="mr-1.5">{category?.emoji}</span>
                        {category?.label}
                      </td>
                      <td className="text-headline truncate py-2 text-right text-ink">
                        <WinnerCell winner={r.winner!} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
