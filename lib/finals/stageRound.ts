/**
 * `finals_matches.stage`/`group` -> el mismo vocabulario de ronda que usa un cuadro
 * real (S/F, ver lib/roundOrder.ts) para el espejo en `matches` (lib/finals/mirror.ts).
 * Función pura y sin nada de base de datos a propósito, para poder probarla sin
 * arrastrar `@/db/client` (que revienta en tiempo de import sin `DATABASE_URL`) a los
 * tests — mismo criterio que el resto de `lib/*` puro de este proyecto.
 */
export function stageRound(m: { stage: string; group: string | null }): string {
  if (m.stage === "group") return `RR-${m.group ?? "?"}`;
  if (m.stage === "semifinal") return "S";
  return "F"; // 'final'
}
