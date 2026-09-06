const WINDOW_DAYS = 364; // 52 semanas exactas
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Arranque de la ventana rolling de 52 semanas del Official Ranking nativo — puntos
 * de ediciones más antiguas que esto ya no cuentan. A propósito, aritmética pura en
 * milisegundos (no `setFullYear`/`setMonth`): eso evita cualquier sorpresa cruzando
 * un año bisiesto, sin necesitar un caso especial para ello.
 */
export function rollingWindowStart(asOf: Date): Date {
  return new Date(asOf.getTime() - WINDOW_DAYS * DAY_MS);
}

/** Inclusive en los dos extremos: [rollingWindowStart(asOf), asOf]. */
export function isWithinRollingWindow(weekStartDate: Date, asOf: Date): boolean {
  const start = rollingWindowStart(asOf);
  return weekStartDate.getTime() >= start.getTime() && weekStartDate.getTime() <= asOf.getTime();
}
