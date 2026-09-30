/**
 * Orden cronológico REAL entre partidos — pura, testeada aparte, sin base de datos.
 * `editions.weekStartDate` (la "recencia" que ya usa todo `lib/newsGeneration/*`, ver
 * el comentario de cabecera de recentForm.ts) es la MISMA para TODAS las rondas de un
 * mismo torneo — una semana ISO entera, no un día — así que por sí sola no distingue
 * un cuarto de final de la Final del MISMO torneo. Un simple `ORDER BY
 * weekStartDate DESC` deja esas filas empatadas, y SQL no garantiza ningún orden
 * concreto entre empatadas.
 *
 * Mismo bug de fondo ya encontrado y arreglado para esto mismo en lib/nextOpponent.ts
 * (comentario 2026-09-05: "un cuarto de final perdido puede tener un id de fila MENOR
 * que una ronda anterior ganada"), pero esa vez el arreglo se quedó solo ahí — bug real
 * reportado de nuevo, 2026-09-30, esta vez en la nota de racha de una pregunta de
 * entrevista ("maastodontee... five-match win streak" cuando la racha real, contando
 * bien las rondas de Chengdu, era otra): dentro del mismo torneo (misma `recencyKey`),
 * la ronda más avanzada en `fullRoundLadder` es siempre la más reciente de verdad.
 */
import { fullRoundLadder } from "../bracket";

export interface ChronologyRow {
  /** `coalesce(editions.week_start_date, make_date(year, 12, 31))` ya calculado, como
   * texto "YYYY-MM-DD" (comparable directamente, sin parsear fecha). */
  recencyKey: string;
  round: string;
  drawSize: number;
}

/** Más reciente primero. Dentro del mismo torneo (misma `recencyKey`), compara por
 * posición en `fullRoundLadder(drawSize)` — nunca por `matches.id` ni por el orden en
 * que Postgres devolviera las filas empatadas. */
export function compareMatchRecency(a: ChronologyRow, b: ChronologyRow): number {
  if (a.recencyKey !== b.recencyKey) return a.recencyKey < b.recencyKey ? 1 : -1;
  const ladder = fullRoundLadder(a.drawSize); // mismo torneo (misma recencyKey) => mismo drawSize
  return ladder.indexOf(b.round) - ladder.indexOf(a.round);
}
