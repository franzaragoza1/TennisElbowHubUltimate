const DAY_MS = 24 * 60 * 60 * 1000;

export interface IsoWeekRef {
  isoYear: number;
  isoWeek: number;
}

/**
 * Semana ISO-8601 de una fecha — nada en el proyecto la calculaba hasta ahora
 * (`editions.isoWeek` siempre venía ya scrapeado de Mana Games); hace falta para
 * los torneos nativos, que no tienen ese dato de ninguna fuente externa.
 *
 * Algoritmo estándar (desplazamiento al jueves): la semana 1 es la que contiene el
 * primer jueves del año — equivalente a "la que contiene el 4 de enero" (regla
 * citada tal cual en el propio estándar).
 */
export function getIsoWeek(date: Date): IsoWeekRef {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (d.getUTCDay() + 6) % 7; // lunes=0 .. domingo=6
  d.setUTCDate(d.getUTCDate() - mondayOffset + 3); // jueves de esa semana

  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayOffset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayOffset + 3);

  const isoWeek = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { isoYear, isoWeek };
}
