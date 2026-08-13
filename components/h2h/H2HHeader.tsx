import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

export interface H2HPlayerInfo {
  id: number;
  displayName: string;
  country: string | null;
  character: string | null;
  currentRank: number | null;
  currentPoints: number | null;
  careerHigh: number | null;
  proSince: number | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-eyebrow text-[11px] text-white/50">{label}</dt>
      <dd className="tour-numeric text-headline text-sm text-white">{value}</dd>
    </div>
  );
}

function PlayerPanel({ player, align }: { player: H2HPlayerInfo; align: "left" | "right" }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-4 ${
        align === "left" ? "sm:items-end" : "sm:items-start"
      }`}
    >
      <div
        className={`flex flex-col items-center gap-3 sm:flex-row ${
          align === "right" ? "sm:flex-row-reverse" : ""
        }`}
      >
        <PlayerAvatar
          displayName={player.displayName}
          country={player.country}
          character={player.character}
          size="lg"
        />
        <Link
          href={`/players/${player.id}`}
          className="text-headline text-center text-xl text-white hover:underline sm:text-left sm:text-2xl"
        >
          {player.displayName}
        </Link>
      </div>
      <dl className="w-full max-w-60 space-y-2 rounded-lg bg-white/5 p-4">
        <Row label="Ranking" value={player.currentRank ? `#${player.currentRank}` : "—"} />
        <Row
          label="Points"
          value={player.currentPoints !== null ? player.currentPoints.toLocaleString("en-US") : "—"}
        />
        <Row label="Career high" value={player.careerHigh ? `#${player.careerHigh}` : "—"} />
        <Row label="Playing since" value={player.proSince ? String(player.proSince) : "—"} />
      </dl>
    </div>
  );
}

export function H2HHeader({
  player1,
  player2,
  player1Wins,
  player2Wins,
}: {
  player1: H2HPlayerInfo;
  player2: H2HPlayerInfo;
  player1Wins: number;
  player2Wins: number;
}) {
  return (
    <div className="bg-navy-900">
      <div className="tour-container py-10">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
          <PlayerPanel player={player1} align="left" />
          <div className="flex shrink-0 items-center gap-6 sm:mt-6">
            <span className="tour-numeric text-headline text-4xl text-white">{player1Wins}</span>
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-accent-500 text-center">
              <span className="text-eyebrow text-[11px] text-white/80">
                Head
                <br />
                to head
              </span>
            </div>
            <span className="tour-numeric text-headline text-4xl text-white">{player2Wins}</span>
          </div>
          <PlayerPanel player={player2} align="right" />
        </div>
      </div>
    </div>
  );
}
