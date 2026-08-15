"use client";

import { useEffect, useRef, useState } from "react";
import { liveCommentary } from "./commentary";
import type { LiveTourMatch } from "./resolveAgainstOngoing";

const POLL_INTERVAL_MS = 30_000;

/** Misma pareja de jugadores puede aparecer como player1/player2 en cualquier orden
 * entre una petición y la siguiente — la clave no depende de esa posición. */
function matchKey(m: LiveTourMatch): string {
  return `${m.editionId}-${[m.player1.id, m.player2.id].sort((a, b) => a - b).join("-")}`;
}

export interface LiveScoresState {
  /** `null` mientras no ha llegado la primera respuesta — distinto de `[]` (ya se
   * comprobó y no hay nada en vivo ahora mismo), para no parpadear "sin partidos" un
   * instante antes de la primera carga real. */
  matches: LiveTourMatch[] | null;
  /** Comentario de cada partido, ya resuelto contra la foto anterior (para poder
   * detectar roturas) — mismo criterio en las tres superficies que lo usan
   * (lib/liveTennis/commentary.ts::liveCommentary). */
  commentaryByMatch: Map<string, string | null>;
}

/**
 * Sondeo compartido de `/api/live-scores` — lo usan `LiveScoresStrip`, el cuadro de
 * torneo y la ficha de jugador, así que vive en un único sitio en vez de triplicar el
 * `useEffect`/`setInterval` y, sobre todo, el seguimiento de "foto anterior" que hace
 * falta para el comentario de rotura (`detectBreak`, que compara dos peticiones).
 */
export function useLiveScores(): LiveScoresState {
  const [matches, setMatches] = useState<LiveTourMatch[] | null>(null);
  const [commentaryByMatch, setCommentaryByMatch] = useState<Map<string, string | null>>(new Map());
  const previousByKey = useRef<Map<string, LiveTourMatch>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/live-scores");
        const data = (await res.json()) as { matches: LiveTourMatch[] };
        if (cancelled) return;

        const commentary = new Map<string, string | null>();
        for (const m of data.matches) {
          const key = matchKey(m);
          commentary.set(key, liveCommentary(m, previousByKey.current.get(key)));
        }
        previousByKey.current = new Map(data.matches.map((m) => [matchKey(m), m]));

        setMatches(data.matches);
        setCommentaryByMatch(commentary);
      } catch {
        if (!cancelled) setMatches((prev) => prev ?? []);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { matches, commentaryByMatch };
}

export { matchKey };
