"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import type { RecentTourWinner } from "@/lib/tourQueries";
import type { FeaturedVideo } from "@/lib/youtube/featured";

const SCROLL_STEP_PX = 300;

/** Mismo trazo que LeadersTable.tsx/BracketColumns.tsx — duplicado a propósito
 * (CLAUDE.md §8: un SVG de 8 líneas no justifica un fichero de iconos compartido). */
function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function WinnerCard({ winner }: { winner: RecentTourWinner }) {
  return (
    <Link
      href={`/players/${winner.championId}`}
      prefetch={false}
      className="hover-lift group flex w-36 shrink-0 snap-start flex-col items-center gap-2.5 rounded-lg border border-white/10 bg-navy-800/60 p-4 text-center transition hover:border-accent-500"
    >
      <span className="text-eyebrow max-w-full truncate rounded-full border border-white/20 px-2.5 py-1 text-[9px] text-white/70">
        {winner.eventName}
      </span>
      <PlayerAvatar
        displayName={winner.championName}
        country={winner.championCountry}
        avatarUrl={winner.championAvatarUrl}
        size="lg"
        onDarkSurface
      />
      <p className="text-headline text-sm text-white group-hover:text-accent-500">{winner.championName}</p>
    </Link>
  );
}

function HighlightTile({ video }: { video: FeaturedVideo }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-navy-800/40 p-2 transition hover:border-accent-500"
    >
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-navy-900">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura remota de YouTube, sin pipeline de next/image */}
        <img src={youtubeThumbnail(video.youtubeVideoId)} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-navy-900/30">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-down text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-white group-hover:text-accent-500">
        {video.caption ?? video.title}
      </p>
    </a>
  );
}

/**
 * Carril "Recent Tour Winners" — pedido explícito (2026-09-17), calcado del mismo
 * carril de atptour.com para `/players`. Mismos botones de flecha explícitos que
 * `LeadersTable.tsx` (arrastrar/deslizar sigue funcionando igual, esto es solo la
 * segunda forma, más descubrible, de moverse) — sin librería de carrusel nueva, el
 * proyecto ya resuelve esto a mano en dos sitios distintos.
 */
export function RecentWinnersCarousel({ winners, highlights }: { winners: RecentTourWinner[]; highlights: FeaturedVideo[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [winners]);

  function scrollByStep(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: "smooth" });
  }

  // Sin campeones todavía (base de datos recién sembrada) — nada de caja navy vacía.
  if (winners.length === 0) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-white/10 bg-navy-900 p-6 shadow-2xl shadow-black/40">
      <h2 className="text-eyebrow mb-4 text-center text-xs text-white/70">Recent Tour Winners</h2>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            aria-label="Scroll winners left"
            className="tap-scale absolute top-1/2 left-0 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-navy-800 text-white shadow-lg transition-colors hover:border-accent-500"
          >
            <ChevronIcon direction="left" />
          </button>
        )}
        <div ref={scrollRef} className="scrollbar-hidden flex snap-x gap-4 overflow-x-auto scroll-smooth pb-1">
          {winners.map((w) => (
            <WinnerCard key={w.editionId} winner={w} />
          ))}
        </div>
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            aria-label="Scroll winners right"
            className="tap-scale absolute top-1/2 right-0 z-10 flex h-9 w-9 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-navy-800 text-white shadow-lg transition-colors hover:border-accent-500"
          >
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>

      {highlights.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
          {highlights.map((v) => (
            <HighlightTile key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
