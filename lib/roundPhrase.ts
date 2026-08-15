import { fullRoundLadder, roundDisplayLabel } from "./bracket";

/** "Round of 128" a la ATP, a partir del código crudo de ronda y el tamaño del draw —
 * reusa `fullRoundLadder`/`roundDisplayLabel` (ya probados contra Cincinnati 2026,
 * ver docs/decisiones.md) en vez de inventar una segunda forma de mapear rondas. */
const PHRASE: Record<string, string> = {
  F: "Final",
  SF: "Semifinals",
  QF: "Quarterfinals",
};

export function roundPhrase(round: string, drawSize: number): string {
  const label = roundDisplayLabel(fullRoundLadder(drawSize), round);
  if (PHRASE[label]) return PHRASE[label];
  const n = label.replace(/^R/, "");
  return /^\d+$/.test(n) ? `Round of ${n}` : label;
}
