import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { surfaceColor } from "@/lib/surfaceColors";

export interface TournamentCardData {
  editionId: number;
  eventName: string;
  year: number;
  isoWeek: number | null;
  surface: string;
  category: string;
  drawSize: number;
  championId: number | null;
  championName: string | null;
  championCountry: string | null;
}

/**
 * Tarjeta de torneo con filete del color de la superficie de pista — que es un dato,
 * no decoración (CLAUDE.md §6). La comparten la home y el índice de torneos.
 */
export function TournamentCard({ data }: { data: TournamentCardData }) {
  return (
    <Link
      href={`/tournaments/${data.editionId}`}
      className="group block overflow-hidden rounded-lg border border-rule bg-paper transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <div className="h-1" style={{ backgroundColor: surfaceColor(data.surface) }} />
      <div className="p-4">
        <p className="text-eyebrow text-[11px] text-muted-label">
          {data.category} · {data.surface}
        </p>
        <p className="text-headline mt-1 truncate text-lg text-navy-900 group-hover:text-blue-500">
          {data.eventName}
        </p>
        <p className="tour-numeric text-muted-label mt-0.5 text-xs">
          {data.year}
          {data.isoWeek ? ` · Week ${data.isoWeek}` : ""} · Draw of {data.drawSize}
        </p>

        <div className="mt-4 flex items-center gap-2 border-t border-rule pt-3">
          {data.championName ? (
            <>
              <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                <CountryFlag
                  country={data.championCountry}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="text-eyebrow text-[10px] text-muted-label">Champion</span>
              <span className="text-headline ml-auto truncate text-sm text-navy-900">
                {data.championName}
              </span>
            </>
          ) : (
            <span className="text-eyebrow text-[10px] text-muted-label">No final on record</span>
          )}
        </div>
      </div>
    </Link>
  );
}
