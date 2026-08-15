import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

export interface PlayerHeaderData {
  displayName: string;
  country: string | null;
  character: string | null;
  currentRank: number | null;
  currentPoints: number | null;
  careerHigh: number | null;
  bestRankWeek: string | null; // "AAAA-WW"
  yearWins: number;
  yearLosses: number;
  yearTitles: number;
  careerWins: number;
  careerLosses: number;
  careerTitles: number;
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div>
      <p className="text-eyebrow text-xs text-white/50">{label}</p>
      <p className="tour-numeric text-headline text-xl text-white sm:text-2xl">{value}</p>
      {caption && <p className="text-muted-label text-xs text-white/40">{caption}</p>}
    </div>
  );
}

export function PlayerHeader({ data }: { data: PlayerHeaderData }) {
  return (
    <div className="bg-navy-900">
      <div className="tour-container py-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <PlayerAvatar
            displayName={data.displayName}
            country={data.country}
            character={data.character}
            size="lg"
          />
          <div>
            <p className="text-eyebrow text-xs text-white/50">
              {data.country ?? "Unknown country"}
            </p>
            <h1 className="text-headline text-3xl text-white sm:text-4xl">{data.displayName}</h1>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-6 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Current rank" value={data.currentRank ? `#${data.currentRank}` : "—"} />
          <Stat
            label="Points"
            value={data.currentPoints !== null ? data.currentPoints.toLocaleString("en-US") : "—"}
          />
          <Stat
            label="Career high"
            value={data.careerHigh ? `#${data.careerHigh}` : "—"}
            caption={data.bestRankWeek ?? undefined}
          />
          <Stat label="YTD W-L" value={`${data.yearWins}-${data.yearLosses}`} />
          <Stat label="Career W-L" value={`${data.careerWins}-${data.careerLosses}`} />
          <Stat label="Titles" value={`${data.careerTitles} (${data.yearTitles} YTD)`} />
        </div>
      </div>
    </div>
  );
}
