/**
 * Fusiona el resultado de re-resolver SOLO las entradas de un MatchLog que mencionan un
 * nombre recién aprobado, con los contadores que el fichero ya tenía guardados — pura,
 * sin base de datos, a propósito (mismo criterio que liveBoardCards.ts: importMatchLog.ts
 * importa `@/db/client`, y eso rompe la resolución del alias dentro de vitest).
 *
 * Aprobar un alias solo puede cambiar el resultado de las entradas que llevan ESE
 * nombre: el resto ya estaba enlazado o ya no casaba por otro motivo, y reprocesarlas
 * (una o dos idas y vueltas a la base de datos POR entrada, fichero a fichero) era lo
 * que hacía que aprobar una sugerencia tardara "una eternidad" (pedido del propietario,
 * 2026-09-26). Toda entrada que llevaba un nombre sin resolver contaba como `skipped`.
 */
export type TargetedOutcome = { kind: "linked" } | { kind: "unmatched" } | { kind: "unresolved"; name: string };

export interface TargetedEntry {
  player1Name: string;
  player2Name: string;
  outcome: TargetedOutcome;
}

export interface FileCounters {
  linked: number;
  skipped: number;
  errors: string[];
  unresolvedNames: string[];
}

const MAX_LOGGED_SKIPS = 100;

function entryPrefix(entry: TargetedEntry): string {
  return `${entry.player1Name} def. ${entry.player2Name}: `;
}

export function mergeTargetedRefresh(prev: FileCounters, approvedNamesLower: Set<string>, processed: TargetedEntry[]): FileCounters {
  let linked = prev.linked;
  let skipped = prev.skipped;

  const prefixes = new Set(processed.map(entryPrefix));
  const errors = prev.errors.filter((line) => ![...prefixes].some((p) => line.startsWith(p)));

  const unresolved = new Set(prev.unresolvedNames.filter((n) => !approvedNamesLower.has(n.toLowerCase())));

  for (const entry of processed) {
    const { outcome } = entry;
    if (outcome.kind === "linked") {
      linked++;
      skipped--;
      continue;
    }
    if (outcome.kind === "unresolved") {
      unresolved.add(outcome.name);
      if (errors.length < MAX_LOGGED_SKIPS) {
        errors.push(`${entryPrefix(entry)}"${outcome.name}" is not a known tour player (or the name is ambiguous)`);
      }
      continue;
    }
    if (errors.length < MAX_LOGGED_SKIPS) errors.push(`${entryPrefix(entry)}no matching tour record found`);
  }

  return { linked, skipped, errors, unresolvedNames: [...unresolved] };
}
