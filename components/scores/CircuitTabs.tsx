"use client";

import Link from "next/link";
import { CIRCUIT_LABEL, type TournamentCircuit } from "@/lib/tournamentCircuit";

const CIRCUITS: TournamentCircuit[] = ["tour", "challenger", "future"];

/** Enlaces reales (no estado local), mismo criterio que `SeasonTabs` — cada pestaña
 * es compartible y navegable con el historial del navegador. */
export function CircuitTabs({ current }: { current: TournamentCircuit }) {
  return (
    <div className="flex gap-2 border-b border-rule">
      {CIRCUITS.map((circuit) => (
        <Link
          key={circuit}
          href={`/scores?circuit=${circuit}`}
          aria-current={circuit === current ? "page" : undefined}
          className={`text-eyebrow border-b-2 px-4 py-2.5 text-xs ${
            circuit === current
              ? "border-blue-500 text-ink"
              : "border-transparent text-muted-label hover:text-ink"
          }`}
        >
          {CIRCUIT_LABEL[circuit]}
        </Link>
      ))}
    </div>
  );
}
