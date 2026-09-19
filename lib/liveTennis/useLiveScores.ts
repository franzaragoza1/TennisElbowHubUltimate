"use client";

import { useEffect, useRef, useState } from "react";
import { liveCommentary } from "./commentary";
import type { LiveTourMatch } from "./resolveAgainstOngoing";
import type { LiveTourMatchWithPrediction } from "../predictor/liveModel";

// 60s (subido desde 30s) — coincide con la ventana de caché compartida del propio
// `/api/live-scores` (ver su comentario): sondear más rápido que eso nunca traía datos
// más frescos, solo peticiones de más. Pedido explícito tras ver crecer "Fluid Active
// CPU" en Vercel más de lo esperado: cortar peticiones de verdad, no solo abaratarlas.
const POLL_INTERVAL_MS = 60_000;

/** Misma pareja de jugadores puede aparecer como player1/player2 en cualquier orden
 * entre una petición y la siguiente — la clave no depende de esa posición. Basta con
 * los dos ids de jugador: dos personas no pueden estar jugándose la una a la otra en
 * dos partidos en vivo distintos a la vez, así que no hace falta nada del torneo. */
function matchKey(m: LiveTourMatch): string {
  return [m.player1.id, m.player2.id].sort((a, b) => a - b).join("-");
}

export interface LiveScoresState {
  /** `null` mientras no ha llegado la primera respuesta — distinto de `[]` (ya se
   * comprobó y no hay nada en vivo ahora mismo), para no parpadear "sin partidos" un
   * instante antes de la primera carga real. */
  matches: LiveTourMatchWithPrediction[] | null;
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
  const [matches, setMatches] = useState<LiveTourMatchWithPrediction[] | null>(null);
  const [commentaryByMatch, setCommentaryByMatch] = useState<Map<string, string | null>>(new Map());
  const previousByKey = useRef<Map<string, LiveTourMatch>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      // Pestaña en segundo plano: nadie la está mirando, así que sondear solo gasta
      // una petición (y su parte de CPU/coste en Vercel) sin que nadie note la
      // diferencia — mismo criterio que ya usa AutoRefresh.tsx. Se retoma solo en
      // cuanto la pestaña vuelve a estar visible (ver el listener de abajo), sin
      // esperar al siguiente intervalo entero.
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/live-scores");
        const data = (await res.json()) as { matches: LiveTourMatchWithPrediction[] };
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

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") poll();
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { matches, commentaryByMatch };
}

export { matchKey };
