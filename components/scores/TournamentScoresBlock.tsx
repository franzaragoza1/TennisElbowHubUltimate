import Link from "next/link";
import { surfaceColor } from "@/lib/surfaceColors";
import { ScoreMatchCard } from "./ScoreMatchCard";
import type { TournamentScoresBlock as TournamentScoresBlockData } from "@/lib/scoresQueries";

/** Réplica del bloque "Cincinnati Open" de la referencia (ver docs/decisiones.md) —
 * cabecera con el nombre del torneo y filete del color de superficie (dato, no
 * decoración, CLAUDE.md §6), enlace directo al cuadro, y hasta 6 partidos recientes. */
export function TournamentScoresBlock({ block }: { block: TournamentScoresBlockData }) {
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
      <div className="h-1" style={{ backgroundColor: surfaceColor(block.surface) }} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper-tint px-4 py-3">
        <div>
          <p className="text-headline text-sm text-ink">{block.tournamentName}</p>
          <p className="text-muted-label text-xs">
            {[block.category, block.surface].filter(Boolean).join(" · ")}
            {block.isoWeek ? ` · Week ${block.isoWeek}` : ""}
          </p>
        </div>
        <Link
          href={`/tournaments/${block.editionId}`}
          className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1.5 text-[10px] text-ink hover:border-blue-500 hover:text-blue-500"
        >
          Draw
        </Link>
      </div>
      <div>
        {block.matches.map((match) => (
          <ScoreMatchCard key={match.id} match={match} drawSize={block.drawSize} />
        ))}
      </div>
    </div>
  );
}
