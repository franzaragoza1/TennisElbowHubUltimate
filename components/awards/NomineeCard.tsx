import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { scoreFromPerspective, type MatchSetScore } from "@/lib/matchScore";
import { roundPhrase } from "@/lib/roundPhrase";
import type { MatchScorePlayer, NominationDisplay } from "@/lib/awards/queries";

/** Quién ganó CADA set en concreto, no el partido — mismo criterio que
 * components/scores/ScoreMatchCard.tsx::setWonBy: el nombre del jugador se resalta
 * según si ganó el partido, pero cada NÚMERO de set se resalta según si ganó ESE set
 * en concreto, así que el ganador del partido puede tener números apagados en los
 * sets que perdió por el camino (bug real reportado: "incorrect sets highlighting" —
 * antes todos los números de la fila del ganador salían resaltados sin más). */
function setWonBy(perspective: "winner" | "loser", sets: MatchSetScore[]): boolean[] {
  return sets.map((s) => (perspective === "winner" ? s.winnerGames > s.loserGames : s.loserGames > s.winnerGames));
}

function ScorePlayerLine({ player, isWinner, sets, perspective }: { player: MatchScorePlayer; isWinner: boolean; sets: MatchSetScore[]; perspective: "winner" | "loser" }) {
  const scores = scoreFromPerspective(sets, perspective === "winner");
  const wonSets = setWonBy(perspective, sets);
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <span className="tour-numeric text-muted-label w-4 shrink-0 text-center text-xs">{player.seed ?? ""}</span>
      <Link
        href={`/players/${player.id}`}
        className={`min-w-0 flex-1 truncate text-sm hover:underline ${isWinner ? "text-headline text-ink" : "text-muted-label"}`}
      >
        {player.displayName}
      </Link>
      <div className="tour-numeric flex shrink-0 items-center gap-1.5">
        {scores.map((s, i) => (
          <span key={i} className={`relative w-3.5 text-center text-xs ${wonSets[i] ? "text-headline text-ink" : "text-muted-label"}`}>
            {s.games}
            {s.superscript !== null && <sup className="absolute -right-1 top-0 text-[8px] font-normal">{s.superscript}</sup>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Point of the Month es sobre UN punto, no sobre quién ganó el partido — pedido
 * explícito: "shouldn't display the score, just the names, their flags and the clip
 * link". Mismas dos filas de bandera+nombre que ScorePlayerLine, sin marcador, sin
 * ronda/torneo, y sin el enlace de "Full match" de más abajo (el enlace que de verdad
 * importa aquí es el propio clip del punto, ya aparte). */
function MatchupNamesRow({ winner, loser }: { winner: MatchScorePlayer; loser: MatchScorePlayer }) {
  return (
    <div className="space-y-1">
      {[winner, loser].map((p) => (
        <div key={p.id} className="flex items-center gap-2 py-0.5">
          <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
            <CountryFlag country={p.country} className="h-full w-full object-cover" />
          </span>
          <Link href={`/players/${p.id}`} className="min-w-0 flex-1 truncate text-sm text-ink hover:underline">
            {p.displayName}
          </Link>
        </div>
      ))}
    </div>
  );
}

/** Miniatura pública de YouTube (`img.youtube.com`, no hace falta clave de API) con un
 * botón de reproducir superpuesto — mismo criterio que el enlace de vídeo de
 * components/players/RecentActivity.tsx, pero como bloque bajo el marcador en vez de
 * un icono diminuto. "Full match", no "Highlights" — pedido explícito: el canal de
 * YouTube del tour sube el partido grabado entero (ver el propio título del vídeo,
 * "... Quarterfinal P1 vs P2 (Online)"), nunca un resumen editado de puntos sueltos,
 * así que "Highlights" describía algo que este vídeo no es. */
function FullMatchLink({ youtubeVideoId }: { youtubeVideoId: string }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg border border-rule bg-paper-tint p-1.5 hover:border-blue-500"
    >
      <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura remota de YouTube, no un asset next/image */}
        <img src={`https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-navy-900/30">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="white" className="drop-shadow">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      <span className="text-eyebrow text-xs text-blue-500">Full match ↗</span>
    </a>
  );
}

/** Tarjeta de un nominado — con marcador completo cuando el nominado lleva un partido
 * (nomineeKind 'player_in_match' | 'match', ver lib/awards/catalog.ts) y con el vídeo
 * del partido cuando ya tiene un YouTube confirmado — pedido explícito, "Add score,
 * stats and video if available to nominees structured like the other screenshot".
 * EXCEPTO 'point_of_month': ahí el partido es solo contexto de quiénes jugaban, el
 * marcador del partido entero no viene a cuento (pedido explícito posterior, "just the
 * names, their flags and the clip link") — ver MatchupNamesRow más abajo. Sin partido
 * (nomineeKind 'player'), cae al nombre simple de siempre. */
export function NomineeCard({
  nominee,
  voteCount,
  showVoteCount,
  isWinner,
}: {
  nominee: NominationDisplay;
  voteCount?: number;
  showVoteCount?: boolean;
  isWinner?: boolean;
}) {
  const md = nominee.matchDetail;

  return (
    <div className={`rounded-lg border p-4 transition-colors ${isWinner ? "border-accent-500 bg-accent-500/10" : "border-rule bg-paper"}`}>
      {isWinner && <p className="text-eyebrow mb-1.5 text-[10px] text-accent-500">Winner</p>}

      {md ? (
        nominee.categoryKey === "point_of_month" ? (
          <MatchupNamesRow winner={md.winner} loser={md.loser} />
        ) : (
          <>
            <p className="text-eyebrow mb-1.5 text-[10px] text-muted-label">
              {roundPhrase(md.round, md.drawSize)} · {md.eventName} {md.year}
            </p>
            <ScorePlayerLine player={md.winner} isWinner sets={md.sets} perspective="winner" />
            <ScorePlayerLine player={md.loser} isWinner={false} sets={md.sets} perspective="loser" />
            {md.youtubeVideoId && <FullMatchLink youtubeVideoId={md.youtubeVideoId} />}
          </>
        )
      ) : (
        nominee.playerName && (
          <div className="flex min-w-0 items-center gap-2">
            <CountryFlag country={nominee.playerCountry} className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm object-cover" />
            {nominee.playerId ? (
              <Link href={`/players/${nominee.playerId}`} className="text-headline truncate text-sm text-ink hover:underline">
                {nominee.playerName}
              </Link>
            ) : (
              <p className="text-headline truncate text-sm text-ink">{nominee.playerName}</p>
            )}
          </div>
        )
      )}

      {nominee.caption && <p className="text-muted-label mt-1.5 text-xs">{nominee.caption}</p>}
      {nominee.clipUrl && (
        <a href={nominee.clipUrl} target="_blank" rel="noopener noreferrer" className="text-eyebrow mt-2 inline-block text-xs text-blue-500 hover:underline">
          Watch clip ↗
        </a>
      )}
      {showVoteCount && (
        <p className="tour-numeric text-headline mt-2 text-sm text-ink">
          {voteCount} vote{voteCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
