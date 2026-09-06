import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { RawLiveMatch, RawLivePlayer } from "./parseLivePage";
import { namesMatch } from "./nameMatch";

export interface LiveMatchPlayer {
  id: number;
  displayName: string;
  country: string | null;
  seed: number | null;
  setGames: string[];
  currentPoint: string;
  serving: boolean;
}

export interface LiveTourMatch {
  editionId: number;
  tournamentName: string;
  round: string;
  drawSize: number;
  player1: LiveMatchPlayer;
  player2: LiveMatchPlayer;
}

interface PendingSlotMatchRow {
  edition_id: number;
  tournament_name: string;
  round: string;
  draw_size: number;
  player1_id: number;
  player1_name: string;
  player1_country: string | null;
  player1_seed: number | null;
  player2_id: number;
  player2_name: string;
  player2_country: string | null;
  player2_seed: number | null;
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/**
 * Tercer criterio pedido: el cruce tiene que corresponder a un hueco real ya emparejado
 * (`pending_slots`, ver db/schema.ts — un partido en curso todavía no tiene fila en
 * `matches`, esa tabla solo guarda desenlaces ya decididos) en una edición que sigue en
 * juego (con cuadro y sin ronda 'F' decidida — mismo criterio que
 * `lib/tourQueries.ts::statusOf`). Sin este cruce, un partido puede cumplir formato y
 * pista y aun así no ser nuestro (otra comunidad reusando el mismo pack de pistas).
 *
 * El nombre de live-tennis.cn y el handle de Mana Games son dos sistemas
 * independientes — el mismo jugador puede salir más corto en uno que en otro (visto
 * en producción: "minato" en live-tennis.cn para "minatonamikaze1643" en Mana Games),
 * así que el cruce se hace por `namesMatch` (sustring insensible a mayúsculas), no por
 * igualdad exacta — con igualdad exacta ese partido en vivo real nunca se encontraba.
 * Una sola consulta para TODOS los huecos en curso (antes era una por candidato) y el
 * cruce en memoria: la lista de huecos pendientes es pequeña (unas pocas decenas como
 * mucho) y los candidatos también, así que no hace falta que la comparación viva en SQL.
 */
export async function resolveAgainstOngoing(candidates: RawLiveMatch[]): Promise<LiveTourMatch[]> {
  if (candidates.length === 0) return [];

  const result = await db.execute(sql`
    SELECT
      ps.edition_id,
      ev.display_name AS tournament_name,
      ps.round,
      e.draw_size,
      p1.id            AS player1_id,
      p1.display_name  AS player1_name,
      COALESCE(p1.country_override, p1.country) AS player1_country,
      ps.player1_seed,
      p2.id            AS player2_id,
      p2.display_name  AS player2_name,
      COALESCE(p2.country_override, p2.country) AS player2_country,
      ps.player2_seed
    FROM pending_slots ps
    JOIN editions e ON e.id = ps.edition_id
    JOIN events ev ON ev.id = e.event_id
    JOIN players p1 ON p1.id = ps.player1_id
    JOIN players p2 ON p2.id = ps.player2_id
    WHERE NOT EXISTS (SELECT 1 FROM matches mf WHERE mf.edition_id = ps.edition_id AND mf.round = 'F')
  `);
  const pendingRows = rowsOf<PendingSlotMatchRow>(result);

  const resolved: LiveTourMatch[] = [];
  for (const candidate of candidates) {
    const row = pendingRows.find(
      (r) =>
        (namesMatch(r.player1_name, candidate.player1.name) && namesMatch(r.player2_name, candidate.player2.name)) ||
        (namesMatch(r.player1_name, candidate.player2.name) && namesMatch(r.player2_name, candidate.player1.name)),
    );
    if (!row) continue;

    const player1Live: RawLivePlayer = namesMatch(row.player1_name, candidate.player1.name) ? candidate.player1 : candidate.player2;
    const player2Live: RawLivePlayer = namesMatch(row.player2_name, candidate.player2.name) ? candidate.player2 : candidate.player1;

    resolved.push({
      editionId: Number(row.edition_id),
      tournamentName: row.tournament_name,
      round: row.round,
      drawSize: Number(row.draw_size),
      player1: {
        id: Number(row.player1_id),
        displayName: row.player1_name,
        country: row.player1_country,
        seed: row.player1_seed === null ? null : Number(row.player1_seed),
        setGames: player1Live.setGames,
        currentPoint: player1Live.currentPoint,
        serving: player1Live.serving,
      },
      player2: {
        id: Number(row.player2_id),
        displayName: row.player2_name,
        country: row.player2_country,
        seed: row.player2_seed === null ? null : Number(row.player2_seed),
        setGames: player2Live.setGames,
        currentPoint: player2Live.currentPoint,
        serving: player2Live.serving,
      },
    });
  }

  return resolved;
}
