/**
 * Lógica pura del recordatorio "hace tiempo que no subes tu MatchLog" — sin imports de
 * `@/db/*` a propósito (mismo motivo que lib/matchLog/nameIndex.ts: que se pueda testear
 * con vitest sin una base de datos real). La consulta de cuándo subió cada usuario su
 * último fichero vive en la ruta que la usa (app/api/account/match-log/reminder/route.ts),
 * no aquí.
 */
export const REMIND_AFTER_DAYS = 14;

export function isUploadOverdue(lastUploadedAt: Date | null, now: Date = new Date()): boolean {
  if (!lastUploadedAt) return true;
  const daysSince = (now.getTime() - lastUploadedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= REMIND_AFTER_DAYS;
}
