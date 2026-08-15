/** Sin dependencias a propósito (ni `@/db`, ni Playwright): así se puede testear sin
 * arrastrar toda la cadena de importaciones de `loadTournament.ts`. */
export function parseTrnInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/[?&]Trn=(\d+)/i);
  return m ? m[1] : null;
}
