/**
 * Formato fijo confirmado del canal (@TennisElbowOnlineTour):
 *
 *   Tennis Elbow 4 <Tournamentname> <Year> <Round> <Player1> (<seed>) vs <Player2> (<seed>) (Online)
 *
 * El seed entre paréntesis es opcional (un jugador sin cabeza de serie no lleva
 * ninguno). "Year" se ancla a `20\d{2}` a propósito — un `\d{4}` genérico confundiría
 * categorías de torneo como "Masters 1000" con el año si el nombre del torneo va
 * antes del año en el título.
 */
export interface ParsedMatchTitle {
  tournamentName: string;
  year: number;
  round: string;
  player1Name: string;
  player1Seed: number | null;
  player2Name: string;
  player2Seed: number | null;
}

const TITLE_PATTERN = /^Tennis Elbow 4\s+(.+?)\s+(20\d{2})\s+(\S+)\s+(.+?)\s+vs\.?\s+(.+?)\s*\(Online\)\s*$/i;
const SEED_SUFFIX = /^(.+?)\s*\((\d+)\)$/;

function splitNameAndSeed(raw: string): { name: string; seed: number | null } {
  const m = SEED_SUFFIX.exec(raw.trim());
  if (!m) return { name: raw.trim(), seed: null };
  return { name: m[1].trim(), seed: Number(m[2]) };
}

export function parseMatchTitle(title: string): ParsedMatchTitle | null {
  const m = TITLE_PATTERN.exec(title.trim());
  if (!m) return null;

  const [, tournamentName, yearRaw, round, player1Raw, player2Raw] = m;
  const player1 = splitNameAndSeed(player1Raw);
  const player2 = splitNameAndSeed(player2Raw);

  return {
    tournamentName: tournamentName.trim(),
    year: Number(yearRaw),
    round: round.trim(),
    player1Name: player1.name,
    player1Seed: player1.seed,
    player2Name: player2.name,
    player2Seed: player2.seed,
  };
}
