import type { LiveMatchPlayer, LiveTourMatch } from "./resolveAgainstOngoing";

/** Todo lo que llega aquí ya pasó `filterCandidates` (best-of-3 obligatorio, ver
 * lib/liveTennis/filterCandidates.ts) — dos sets ganados cierran el partido siempre,
 * no hace falta llevar `bestOf` en `LiveTourMatch` solo para esto. */
const SETS_TO_WIN = 2;

const POINT_RANK: Record<string, number> = { "0": 0, "15": 1, "30": 2, "40": 3, Ad: 4 };

function pointRank(point: string): number | null {
  return point in POINT_RANK ? POINT_RANK[point] : null;
}

/** Juegos del set EN CURSO (el último de `setGames`) — `null` si no hay ninguno
 * todavía (partido recién empezado) o si el valor no es un número reconocible. */
function currentSetGames(player: LiveMatchPlayer): number | null {
  const last = player.setGames[player.setGames.length - 1];
  if (last === undefined) return null;
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
}

/** Un set ya decidido (>=6 juegos con 2 de ventaja) no es "el set en curso" — puede
 * pasar si la fuente todavía no ha abierto el hueco del set siguiente. Sin esto, un set
 * ya ganado 6-4 se leería como "set point" para siempre. */
function isSetDecided(games: number, oppGames: number): boolean {
  return (games >= 6 && games - oppGames >= 2) || (oppGames >= 6 && oppGames - games >= 2);
}

/** "Un juego más y se lleva el set", en los casos sin ambigüedad — 6-6 (tiebreak) se
 * deja fuera a propósito: no tenemos el marcador del tiebreak, solo el recuento de
 * juegos del set, y adivinar quién va ganando el tiebreak sería inventar. */
function hasSetPoint(games: number, oppGames: number): boolean {
  if (isSetDecided(games, oppGames)) return false;
  return games >= 5 && games >= oppGames + 1;
}

/** Sets ya completados y ganados por este jugador, sin contar el que está en curso —
 * para saber si el set point de ahora mismo sería también el del partido. */
function completedSetsWon(player: LiveMatchPlayer, opponent: LiveMatchPlayer): number {
  let won = 0;
  // El último elemento es el set en curso (o el más reciente en marcha); solo los
  // anteriores están necesariamente cerrados.
  for (let i = 0; i < player.setGames.length - 1; i++) {
    const g = Number(player.setGames[i]);
    const og = Number(opponent.setGames[i]);
    if (Number.isFinite(g) && Number.isFinite(og) && g > og) won++;
  }
  return won;
}

export interface PointCommentary {
  kind: "deuce" | "game-point" | "break-point" | "set-point" | "match-point-serving" | "match-point-returning";
  player: LiveMatchPlayer;
}

/**
 * Comentario derivable de UNA sola foto del marcador (sin comparar contra la petición
 * anterior) — deuce, punto de juego/rotura, y punto de set/partido, con el servidor y
 * el que resta identificados por `serving`. Devuelve `null` en cualquier caso ambiguo
 * (etiqueta de punto no reconocida, 6-6 de set) en vez de adivinar.
 */
export function singleSnapshotCommentary(match: LiveTourMatch): PointCommentary | null {
  const server = match.player1.serving ? match.player1 : match.player2.serving ? match.player2 : null;
  const returner = server === match.player1 ? match.player2 : server === match.player2 ? match.player1 : null;
  if (!server || !returner) return null;

  const serverPoint = pointRank(server.currentPoint);
  const returnerPoint = pointRank(returner.currentPoint);
  if (serverPoint !== null && returnerPoint !== null) {
    if (serverPoint === 3 && returnerPoint === 3) return { kind: "deuce", player: server };

    const gamePointPlayer =
      (serverPoint === 3 && returnerPoint < 3) || serverPoint === 4
        ? server
        : (returnerPoint === 3 && serverPoint < 3) || returnerPoint === 4
          ? returner
          : null;

    if (gamePointPlayer) {
      const isServerPoint = gamePointPlayer === server;
      const gp = isServerPoint ? server : returner;
      const opp = isServerPoint ? returner : server;
      const gpGames = currentSetGames(gp);
      const oppGames = currentSetGames(opp);

      if (gpGames !== null && oppGames !== null && hasSetPoint(gpGames, oppGames)) {
        const gpSetsWon = completedSetsWon(gp, opp);
        if (gpSetsWon === SETS_TO_WIN - 1) {
          return { kind: isServerPoint ? "match-point-serving" : "match-point-returning", player: gp };
        }
        return { kind: "set-point", player: gp };
      }

      return { kind: isServerPoint ? "game-point" : "break-point", player: gp };
    }
  }

  // Sin nada que contar sobre el punto en curso (etiqueta rara o iguales sin ser 40),
  // todavía puede haber un set/match point "en el aire" por el marcador de juegos —
  // pero sin saber quién va ganando el punto ahora mismo no hay frase honesta que dar.
  return null;
}

/**
 * "X breaks" necesita DOS fotos, no una — se detecta comparando la petición anterior
 * con la actual: si quien sacaba cambió y los juegos del que dejó de sacar NO subieron
 * en el set en curso mientras los del otro sí, ese juego se acaba de ganar al resto.
 * `null` si no hay foto anterior, si el set cambió entre medias, o si la comparación no
 * es concluyente — nunca se inventa una rotura.
 */
export function detectBreak(previous: LiveTourMatch | undefined, current: LiveTourMatch): string | null {
  if (!previous) return null;

  const prevServer = previous.player1.serving ? previous.player1 : previous.player2.serving ? previous.player2 : null;
  const currServer = current.player1.serving ? current.player1 : current.player2.serving ? current.player2 : null;
  if (!prevServer || !currServer || prevServer.id === currServer.id) return null;

  // El que sacaba antes es quien acaba de perder su saque, si de verdad se rompió —
  // se localiza a los dos jugadores de la foto ACTUAL por id, no por posición
  // player1/player2 (que puede no coincidir entre las dos fotos).
  const prevReturner = prevServer.id === previous.player1.id ? previous.player2 : previous.player1;
  const currPrevServerSide = current.player1.id === prevServer.id ? current.player1 : current.player2;
  const currPrevReturnerSide = current.player1.id === prevReturner.id ? current.player1 : current.player2;
  if (currPrevServerSide.id !== prevServer.id || currPrevReturnerSide.id !== prevReturner.id) return null;

  const prevServerGames = currentSetGames(prevServer);
  const currServerSideGames = currentSetGames(currPrevServerSide);
  const prevReturnerGames = currentSetGames(prevReturner);
  const currReturnerSideGames = currentSetGames(currPrevReturnerSide);
  if (
    prevServerGames === null ||
    currServerSideGames === null ||
    prevReturnerGames === null ||
    currReturnerSideGames === null
  ) {
    return null;
  }
  // Mismo set en las dos fotos (el número de sets ya jugados no cambió) y el que
  // devolvía sumó un juego mientras el que sacaba se quedó igual.
  if (previous.player1.setGames.length !== current.player1.setGames.length) return null;
  if (currServerSideGames !== prevServerGames) return null;
  if (currReturnerSideGames !== prevReturnerGames + 1) return null;

  return `${currPrevReturnerSide.displayName} breaks`;
}

export function phraseFor(commentary: PointCommentary): string {
  switch (commentary.kind) {
    case "deuce":
      return "Deuce";
    case "game-point":
      return `Game point, ${commentary.player.displayName}`;
    case "break-point":
      return `Break point, ${commentary.player.displayName}`;
    case "set-point":
      return `Set point, ${commentary.player.displayName}`;
    case "match-point-serving":
      return `${commentary.player.displayName} serves for the match`;
    case "match-point-returning":
      return `${commentary.player.displayName} has match point`;
  }
}

/** Frase de saque específica para el que saca cuando el punto de partido es del rival —
 * "sirve para no quedar eliminado", pedida tal cual en la solicitud original. Se
 * calcula aparte de `phraseFor` porque necesita saber quién sacaba, no solo quién tiene
 * el punto. */
function servingToStayInMatch(match: LiveTourMatch, commentary: PointCommentary): string | null {
  if (commentary.kind !== "match-point-returning") return null;
  const server = match.player1.serving ? match.player1 : match.player2.serving ? match.player2 : null;
  if (!server || server.id === commentary.player.id) return null;
  return `${server.displayName} serves to stay in the match`;
}

/**
 * Punto de entrada único que usan las tres superficies (Live Now, cuadro, ficha de
 * jugador) — mismo criterio en los tres sitios. Prioriza la rotura recién detectada
 * (evento) sobre el estado del punto actual (foto fija), porque es la información más
 * nueva; si no hay rotura que contar, cae al comentario de una sola foto.
 */
export function liveCommentary(match: LiveTourMatch, previous?: LiveTourMatch): string | null {
  const brk = detectBreak(previous, match);
  if (brk) return brk;

  const snapshot = singleSnapshotCommentary(match);
  if (!snapshot) return null;

  return servingToStayInMatch(match, snapshot) ?? phraseFor(snapshot);
}
