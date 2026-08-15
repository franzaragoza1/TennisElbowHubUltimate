/**
 * Tipos compartidos por el motor de grupos de Tour Finals (standings, clasificación,
 * eliminatorias). Deliberadamente independientes de `db/schema.ts`: estas funciones son
 * puras y se prueban con fixtures, sin tocar la base de datos.
 */
export interface FinalsMatchResult {
  id: number;
  player1Id: number;
  player2Id: number;
  winnerId: number;
  sets: { winnerGames: number; loserGames: number }[]; // en perspectiva del ganador del set, igual que `sets`
}
