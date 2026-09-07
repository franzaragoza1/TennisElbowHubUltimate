/**
 * Edad en años cumplidos a partir de `players.birthDate` — nunca se guarda un número
 * de edad aparte (quedaría desactualizado al día siguiente), se deriva aquí cada vez
 * que hace falta pintarla. `birthDate` llega como string "YYYY-MM-DD" (así devuelve
 * Drizzle una columna `date`, ver db/schema.ts y el mismo patrón en
 * `editions.weekStartDate`), no como `Date`.
 */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const born = new Date(birthDate);
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  const dayDiff = now.getUTCDate() - born.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
}
