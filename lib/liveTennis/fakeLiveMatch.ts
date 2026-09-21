import { STANDARD_FORMAT } from "@/lib/tennisScore";
import type { LiveTourMatch } from "./resolveAgainstOngoing";

/** Marca de fábrica del partido de pega — así app/admin/scores/actions.ts sabe si ya
 * está inyectado sin más estado que la propia fila de `live_scores_cache`, y puede
 * quitarlo sin tocar ningún partido real que el sync de verdad haya escrito ahí. */
export const FAKE_LIVE_MATCH_TOURNAMENT_NAME = "Fake Test Match (dev only)";

/**
 * Un partido de mentira para probar la tira de "Live Now" (comentario en vivo, Win%,
 * y más adelante el aviso push de "se puso en directo") sin esperar a que haya un
 * partido de verdad ni tener que levantar scripts/liveScoresSync.ts contra
 * live-tennis.cn en local. Usa dos jugadores reales del Test Draw Open (ids 1 y 2) en
 * vez de ids inventados — así el resto del sitio (avatar, bandera, enlace a su ficha,
 * Win% vía getPlayerServeWinRate) se comporta exactamente igual que con un partido
 * real, sin inventar datos de un jugador de verdad del tour. `dedupKey` fijo
 * ("fake:test-match") a propósito: como pasa por el mismo
 * lib/pushNotifications/notifyLiveMatches.ts que un partido real (ver
 * scripts/liveScoresSync.ts), seguir a Ace Ventura o Bjorn Bold y encender este
 * toggle es la forma real de probar ese aviso de "se puso en directo" de principio a
 * fin sin esperar a un partido real — la clave fija hace que solo avise la PRIMERA
 * vez que se enciende (el resto de veces ya está en `live_match_alerts`, que es
 * justo lo que ese dedup debe hacer).
 */
export function buildFakeLiveMatch(): LiveTourMatch {
  return {
    tournamentName: FAKE_LIVE_MATCH_TOURNAMENT_NAME,
    roundLabel: "SF",
    linkHref: "/tournaments",
    format: STANDARD_FORMAT,
    editionId: null,
    dedupKey: "fake:test-match",
    player1: {
      id: 1,
      displayName: "Ace Ventura",
      country: "US",
      seed: 3,
      setGames: ["6", "3"],
      currentPoint: "40",
      serving: true,
      // Elo de mentira, distintos a propósito — para poder probar en local el blend de
      // lib/predictor/liveModel.ts sin esperar a un partido real con elo de verdad.
      elo: 1200,
    },
    player2: {
      id: 2,
      displayName: "Bjorn Bold",
      country: "SE",
      seed: null,
      setGames: ["3", "2"],
      currentPoint: "30",
      serving: false,
      elo: 1000,
    },
  };
}
