/**
 * Fechas del anuncio de un torneo a partir de su semana ISO — extraído de
 * `commands/newTournament.ts` (2026-10-04) para que `tasks/announceNewTournament.ts`
 * (el anuncio automático al abrir inscripción) calcule exactamente las mismas fechas
 * que el comando manual, sin una segunda copia que pudiera desincronizarse.
 */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatWithSuffix(date: Date): string {
  const day = date.getUTCDate();
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${day}${ordinalSuffix(day)}`;
}

// Lunes de la semana ISO `week` del año `year` — mismo resultado que
// `datetime.date.fromisocalendar` de Python (el 4 de enero SIEMPRE cae en la semana 1
// del calendario ISO, es el ancla estándar del algoritmo).
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // domingo=0 -> 7, para que lunes=1..domingo=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

export interface TournamentSchedule {
  startDate: string;
  queueUntil: string;
}

export function calculateSchedule(targetWeek: number, year: number): TournamentSchedule {
  const monday = isoWeekMonday(year, targetWeek);
  const startDate = new Date(monday);
  startDate.setUTCDate(monday.getUTCDate() - 2); // sábado anterior
  const queueUntil = new Date(startDate);
  queueUntil.setUTCDate(startDate.getUTCDate() - 1); // viernes anterior a ese sábado
  return { startDate: formatWithSuffix(startDate), queueUntil: formatWithSuffix(queueUntil) };
}
