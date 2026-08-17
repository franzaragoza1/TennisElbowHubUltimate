"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { roundLabel } from "@/lib/roundOrder";
import type { SearchResults } from "@/lib/search";

const EMPTY: SearchResults = { players: [], tournaments: [], news: [], videos: [], matches: [] };

function thumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function totalResults(results: SearchResults): number {
  return (
    results.players.length + results.tournaments.length + results.news.length + results.videos.length + results.matches.length
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule pb-3 last:border-0 last:pb-0">
      <p className="text-eyebrow px-4 pt-3 pb-1 text-[10px] text-muted-label">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

/** Cada fila entra con un ligero deslizamiento, escalonada por índice — el
 * desplegable entero nunca "aparece" de golpe. `prefers-reduced-motion` ya
 * desactiva esto a nivel global (app/globals.css). */
function ResultRow({
  href,
  external,
  onNavigate,
  index,
  children,
}: {
  href: string;
  external?: boolean;
  onNavigate: () => void;
  index: number;
  children: React.ReactNode;
}) {
  const className =
    "animate-in fade-in slide-in-from-top-1 flex items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-paper-tint";
  const style = { animationDelay: `${Math.min(index, 8) * 25}ms`, animationDuration: "200ms", animationFillMode: "backwards" as const };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style} onClick={onNavigate}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style} onClick={onNavigate}>
      {children}
    </Link>
  );
}

export function SearchBar() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function collapse() {
    setExpanded(false);
    setQuery("");
    setResults(EMPTY);
  }

  useEffect(() => {
    if (expanded) requestAnimationFrame(() => inputRef.current?.focus());
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [expanded]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data: SearchResults) => setResults(data))
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  const hasResults = totalResults(results) > 0;
  const showDropdown = expanded && hasQuery;
  let rowIndex = 0;

  return (
    // Tamaño fijo (`w-9 h-9`) SIEMPRE, aunque la píldora de dentro crezca — si el
    // contenedor creciera con ella, empujaría al resto de la fila (`justify-between`)
    // y el `overflow-x-auto` de `<nav>` acababa mostrando una barra de scroll
    // horizontal fantasma al abrir la búsqueda. La píldora crece en `absolute`, por
    // encima del resto (`z-20`), nunca en el flujo normal.
    <div ref={containerRef} className="relative h-9 w-9 shrink-0">
      <div
        className={`absolute top-0 right-0 z-20 flex h-9 items-center overflow-hidden rounded-full bg-white/10 transition-[width,background-color] duration-300 ease-out ${
          expanded ? "w-56 bg-white/15 sm:w-72" : "w-9"
        }`}
      >
        <button
          type="button"
          aria-label={expanded ? "Close search" : "Search"}
          onClick={() => (expanded ? collapse() : setExpanded(true))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-300 ease-out ${expanded ? "rotate-90" : "rotate-0"}`}
          >
            {expanded ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </>
            )}
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the tour…"
          tabIndex={expanded ? 0 : -1}
          className={`min-w-0 flex-1 bg-transparent pr-3 text-sm text-white outline-none transition-opacity duration-200 placeholder:text-white/40 ${
            expanded ? "opacity-100 delay-150" : "opacity-0"
          }`}
        />
      </div>

      {showDropdown && (
        <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-50 mt-2 w-[88vw] max-w-sm origin-top-right overflow-hidden rounded-lg border border-rule bg-paper shadow-xl duration-200 sm:w-96">
          <div className="max-h-[70vh] overflow-y-auto">
            {loading && !hasResults && <p className="text-muted-label px-4 py-8 text-center text-sm">Searching…</p>}

            {!loading && !hasResults && (
              <p className="text-muted-label px-4 py-8 text-center text-sm">No results for &ldquo;{query.trim()}&rdquo;.</p>
            )}

            {results.players.length > 0 && (
              <ResultSection title="Players">
                {results.players.map((p) => (
                  <ResultRow key={p.id} href={`/players/${p.id}`} onNavigate={collapse} index={rowIndex++}>
                    <PlayerAvatar displayName={p.displayName} country={p.country} size="sm" />
                    <span className="text-ink truncate text-sm font-medium">{p.displayName}</span>
                  </ResultRow>
                ))}
              </ResultSection>
            )}

            {results.tournaments.length > 0 && (
              <ResultSection title="Tournaments">
                {results.tournaments.map((t) => (
                  <ResultRow key={t.editionId} href={`/tournaments/${t.editionId}`} onNavigate={collapse} index={rowIndex++}>
                    <span className="text-ink truncate text-sm font-medium">{t.eventName}</span>
                    <span className="text-muted-label ml-auto shrink-0 text-xs">{t.year}</span>
                  </ResultRow>
                ))}
              </ResultSection>
            )}

            {results.matches.length > 0 && (
              <ResultSection title="Matches">
                {results.matches.map((m, i) => (
                  <ResultRow
                    key={`${m.editionId}-${i}`}
                    href={`/tournaments/${m.editionId}`}
                    onNavigate={collapse}
                    index={rowIndex++}
                  >
                    <span className="text-ink truncate text-sm">
                      {m.player1Name} <span className="text-muted-label">vs</span> {m.player2Name}
                    </span>
                    <span className="text-muted-label ml-auto shrink-0 text-xs">
                      {roundLabel(m.round)} · {m.eventName} {m.year}
                    </span>
                  </ResultRow>
                ))}
              </ResultSection>
            )}

            {results.news.length > 0 && (
              <ResultSection title="News">
                {results.news.map((n) => (
                  <ResultRow key={n.slug} href={`/news/${n.slug}`} onNavigate={collapse} index={rowIndex++}>
                    <span className="text-ink truncate text-sm font-medium">{n.title}</span>
                  </ResultRow>
                ))}
              </ResultSection>
            )}

            {results.videos.length > 0 && (
              <ResultSection title="Videos">
                {results.videos.map((v) => (
                  <ResultRow
                    key={v.youtubeVideoId}
                    href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                    external
                    onNavigate={collapse}
                    index={rowIndex++}
                  >
                    <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-paper-tint">
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura remota de YouTube */}
                      <img src={thumbnailUrl(v.youtubeVideoId)} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="text-ink line-clamp-2 text-xs">{v.title}</span>
                  </ResultRow>
                ))}
              </ResultSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
