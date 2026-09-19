import Link from "next/link";
import Image from "next/image";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import type { LeaderboardRow, MarqueePickDisplay } from "@/lib/predictions/queries";

const DASH = "—";

/**
 * Una celda "de cartel" (campeón/finalista/semifinalista) — el aviso de ronda real
 * ("W", "F", "SF", "R32"...) recuadrado en verde cuando acertó la categoría EXACTA que
 * se le pedía a ese hueco, en rojo sin recuadro si no, o gris si el jugador sigue vivo
 * sin desenlace todavía (o no hay pick para este hueco).
 */
function MarqueeCell({ pick }: { pick: MarqueePickDisplay }) {
  if (pick.playerId === null || pick.displayName === null) {
    return <span className="text-muted-label text-sm">{DASH}</span>;
  }
  const tagClasses =
    pick.correct === true
      ? "border border-up text-up bg-up/10"
      : pick.correct === false
        ? "text-down"
        : "text-muted-label";
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {pick.roundLabel && <span className={`text-eyebrow shrink-0 rounded px-1 py-0.5 text-[10px] ${tagClasses}`}>{pick.roundLabel}</span>}
      <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={pick.country} className="h-full w-full object-cover" />
      </span>
      <span className="min-w-0 truncate text-sm text-ink">{pick.displayName}</span>
    </div>
  );
}

export function PredictionLeaderboardTable({ rows, editionId }: { rows: LeaderboardRow[]; editionId: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-paper shadow-sm">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-rule bg-paper-tint text-left">
            <th className="text-eyebrow w-10 px-3 py-3 text-xs text-muted-label">#</th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Predictor</th>
            <th className="text-eyebrow w-16 px-3 py-3 text-right text-xs text-muted-label">Score</th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Champion</th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Finalist</th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Semifinalist 1</th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Semifinalist 2</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.userId} className="row-reveal border-b border-rule transition-colors last:border-0 hover:bg-paper-tint" style={{ "--reveal-delay": `${Math.min(i, 20) * 15}ms` } as React.CSSProperties}>
              <td className="tour-numeric px-3 py-3 text-muted-label">{i + 1}</td>
              <td className="px-3 py-3">
                <Link href={`/tournaments/${editionId}/predict/${row.userId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                  {row.userImage ? (
                    <Image src={row.userImage} alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded-full" unoptimized />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full bg-rule" />
                  )}
                  <span className="min-w-0 truncate text-sm text-ink">{row.userName ?? "Anonymous"}</span>
                </Link>
              </td>
              <td className="tour-numeric text-headline px-3 py-3 text-right text-ink">{row.score}</td>
              <td className="px-3 py-3">
                <MarqueeCell pick={row.champion} />
              </td>
              <td className="px-3 py-3">
                <MarqueeCell pick={row.finalist} />
              </td>
              <td className="px-3 py-3">
                <MarqueeCell pick={row.semifinalist1} />
              </td>
              <td className="px-3 py-3">
                <MarqueeCell pick={row.semifinalist2} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
