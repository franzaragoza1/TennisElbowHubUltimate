import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getFinalsFormat } from "@/lib/finals/format";
import { roundPhrase } from "@/lib/roundPhrase";
import { STANDARD_FORMAT, type SetFormat } from "@/lib/tennisScore";
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
  tournamentName: string;
  roundLabel: string;
  /** A dónde manda el botón "Draw"/"View draw" — `/tournaments/<id>` siempre (no hay
   * /finals/[id] propio, retirado 2026-09-09). Para un partido de Tour/Next Gen
   * Finals TODAVÍA EN VIVO sin decidir, esa edición puede no tener espejo creado
   * todavía (solo se crea al decidirse el primer partido, lib/finals/mirror.ts) —
   * cae al listado general de torneos en ese caso raro y transitorio. */
  linkHref: string;
  /** Cuántos sets hace falta ganar y de cuántos juegos es cada set — la mayoría del
   * tour es al mejor de 3 a 6 juegos, pero GS es al mejor de 5 y Next Gen Finals es al
   * mejor de 5 en Fast4 (a 4 juegos). Sin esto, el comentario en vivo (set/match point)
   * se equivocaba siempre que un partido no era el formato estándar. */
  format: SetFormat;
  /** `editions.id` real del sitio — `null` para un partido de Finals todavía sin
   * espejo creado (mismo caso raro que `linkHref` de arriba). Es la clave que
   * lib/pushNotifications/notifyLiveMatches.ts usa para "quién sigue ESTE torneo";
   * un partido de Tour normal siempre la tiene. */
  editionId: number | null;
  /** Identidad estable de "este cruce, en esta edición" para el aviso push de "se
   * puso en directo" (lib/pushNotifications/notifyLiveMatches.ts) — un `INSERT ...
   * ON CONFLICT DO NOTHING` sobre esta columna (`live_match_alerts.dedup_key`) es lo
   * que distingue "ya avisado" de "transición nueva de verdad" sin depender de
   * estado en memoria que un reinicio del proceso perdería. Usa el id INTERNO de la
   * edición (de Tour o de Finals, nunca el `editionId` de arriba que puede ser
   * `null`) + los dos ids de jugador ordenados — un mismo par de jugadores no puede
   * jugarse a sí mismo dos veces a la vez en la misma edición. */
  dedupKey: string;
  player1: LiveMatchPlayer;
  player2: LiveMatchPlayer;
}

interface PendingSlotMatchRow {
  tournament_name: string;
  round: string;
  draw_size: number;
  category: string;
  edition_id: number;
  player1_id: number;
  player1_name: string;
  player1_country: string | null;
  player1_seed: number | null;
  player2_id: number;
  player2_name: string;
  player2_country: string | null;
  player2_seed: number | null;
}

interface FinalsMatchRow {
  finals_edition_id: number;
  mirrored_edition_id: number | null;
  kind: string;
  display_name: string;
  stage: string;
  group: string | null;
  player1_id: number;
  player1_name: string;
  player1_country: string | null;
  player2_id: number;
  player2_name: string;
  player2_country: string | null;
}

interface CandidateRow {
  tournamentName: string;
  roundLabel: string;
  linkHref: string;
  format: SetFormat;
  editionId: number | null;
  dedupKey: string;
  player1Id: number;
  player1Name: string;
  player1Country: string | null;
  player1Seed: number | null;
  player2Id: number;
  player2Name: string;
  player2Country: string | null;
  player2Seed: number | null;
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/** Mismos dos ids, en cualquier orden entre un cruce y el que lo resuelve más abajo →
 * la misma clave — ver el comentario de `LiveTourMatch.dedupKey`. */
function sortedPlayerPair(player1Id: number, player2Id: number): string {
  return [player1Id, player2Id].sort((a, b) => a - b).join("-");
}

/** "Group A"/"Group B" en fase de grupos, "Semifinal"/"Final" en eliminatoria — mismo
 * texto que ya usa el resto de la sección de Finals (ver components/finals/). */
function finalsRoundLabel(stage: string, group: string | null): string {
  if (stage === "group") return group ? `Group ${group}` : "Group stage";
  if (stage === "semifinal") return "Semifinal";
  if (stage === "final") return "Final";
  return stage;
}

/**
 * Huecos del tour normal ya emparejados (`pending_slots`, ver db/schema.ts — un
 * partido en curso todavía no tiene fila en `matches`, esa tabla solo guarda
 * desenlaces ya decididos) en una edición que sigue en juego (con cuadro y sin ronda
 * 'F' decidida — mismo criterio que `lib/tourQueries.ts::statusOf`). El formato
 * depende de la categoría: GS es al mejor de 5, el resto del tour al mejor de 3
 * (Finals tiene su propio camino aparte, ver `ongoingFinalsMatches`).
 */
async function ongoingTourMatches(): Promise<CandidateRow[]> {
  const result = await db.execute(sql`
    SELECT
      ev.display_name AS tournament_name,
      ps.round,
      e.draw_size,
      e.category,
      ps.edition_id,
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

  return rowsOf<PendingSlotMatchRow>(result).map((r) => ({
    tournamentName: r.tournament_name,
    roundLabel: roundPhrase(r.round, Number(r.draw_size)),
    linkHref: `/tournaments/${r.edition_id}`,
    format: r.category === "GS" ? { gamesPerSet: 6, setsToWin: 3 } : STANDARD_FORMAT,
    editionId: Number(r.edition_id),
    dedupKey: `tour:${r.edition_id}:${sortedPlayerPair(Number(r.player1_id), Number(r.player2_id))}`,
    player1Id: Number(r.player1_id),
    player1Name: r.player1_name,
    player1Country: r.player1_country,
    player1Seed: r.player1_seed === null ? null : Number(r.player1_seed),
    player2Id: Number(r.player2_id),
    player2Name: r.player2_name,
    player2Country: r.player2_country,
    player2Seed: r.player2_seed === null ? null : Number(r.player2_seed),
  }));
}

/**
 * Partidos de Tour/Next Gen Finals todavía sin decidir (`outcome = 'scheduled'`, los
 * dos lados ya propagados — un cruce de eliminatoria vacío no puede estar "en vivo").
 * Viven en sus propias tablas (`finals_matches`/`finals_editions`), nunca en
 * `pending_slots` (ver comentario de `finalsEditions` en db/schema.ts), así que hacía
 * falta esta segunda consulta aparte para que sus partidos en vivo pudieran resolverse
 * — antes de esto ni siquiera llegaban a intentarlo.
 */
async function ongoingFinalsMatches(): Promise<CandidateRow[]> {
  const result = await db.execute(sql`
    SELECT
      fm.finals_edition_id,
      fe.mirrored_edition_id,
      fe.kind,
      fe.display_name,
      fm.stage,
      fm."group",
      p1.id            AS player1_id,
      p1.display_name  AS player1_name,
      COALESCE(p1.country_override, p1.country) AS player1_country,
      p2.id            AS player2_id,
      p2.display_name  AS player2_name,
      COALESCE(p2.country_override, p2.country) AS player2_country
    FROM finals_matches fm
    JOIN finals_editions fe ON fe.id = fm.finals_edition_id
    JOIN players p1 ON p1.id = fm.player1_id
    JOIN players p2 ON p2.id = fm.player2_id
    WHERE fm.outcome = 'scheduled'
  `);

  return rowsOf<FinalsMatchRow>(result).map((r) => ({
    tournamentName: r.display_name,
    roundLabel: finalsRoundLabel(r.stage, r.group),
    linkHref: r.mirrored_edition_id !== null ? `/tournaments/${r.mirrored_edition_id}` : "/tournaments",
    format: getFinalsFormat(r.kind),
    editionId: r.mirrored_edition_id !== null ? Number(r.mirrored_edition_id) : null,
    // El id INTERNO de `finals_editions`, no el `mirrored_edition_id` de arriba (que
    // puede ser `null`) — este siempre existe y es estable, ver el comentario de
    // `LiveTourMatch.dedupKey`.
    dedupKey: `finals:${r.finals_edition_id}:${sortedPlayerPair(Number(r.player1_id), Number(r.player2_id))}`,
    player1Id: Number(r.player1_id),
    player1Name: r.player1_name,
    player1Country: r.player1_country,
    player1Seed: null, // el seed de grupo (1-8) no es el mismo concepto que un seed de cuadro — se omite antes que confundir
    player2Id: Number(r.player2_id),
    player2Name: r.player2_name,
    player2Country: r.player2_country,
    player2Seed: null,
  }));
}

/**
 * Tercer criterio pedido: el cruce tiene que corresponder a un partido real nuestro en
 * curso (tour normal o Finals), nunca solo por formato y pista (otra comunidad puede
 * reusar el mismo pack de pistas).
 *
 * El nombre de live-tennis.cn y el handle de Mana Games son dos sistemas
 * independientes — el mismo jugador puede salir más corto en uno que en otro (visto
 * en producción: "minato" en live-tennis.cn para "minatonamikaze1643" en Mana Games),
 * así que el cruce se hace por `namesMatch` (sustring insensible a mayúsculas), no por
 * igualdad exacta — con igualdad exacta ese partido en vivo real nunca se encontraba.
 * Una sola consulta por fuente para TODOS los huecos en curso (antes era una por
 * candidato) y el cruce en memoria: la lista de huecos pendientes es pequeña (unas
 * pocas decenas como mucho) y los candidatos también, así que no hace falta que la
 * comparación viva en SQL.
 */
export async function resolveAgainstOngoing(candidates: RawLiveMatch[]): Promise<LiveTourMatch[]> {
  if (candidates.length === 0) return [];

  const [tourRows, finalsRows] = await Promise.all([ongoingTourMatches(), ongoingFinalsMatches()]);
  const pendingRows = [...tourRows, ...finalsRows];

  const resolved: LiveTourMatch[] = [];
  for (const candidate of candidates) {
    const row = pendingRows.find(
      (r) =>
        (namesMatch(r.player1Name, candidate.player1.name) && namesMatch(r.player2Name, candidate.player2.name)) ||
        (namesMatch(r.player1Name, candidate.player2.name) && namesMatch(r.player2Name, candidate.player1.name)),
    );
    if (!row) continue;

    const player1Live: RawLivePlayer = namesMatch(row.player1Name, candidate.player1.name) ? candidate.player1 : candidate.player2;
    const player2Live: RawLivePlayer = namesMatch(row.player2Name, candidate.player2.name) ? candidate.player2 : candidate.player1;

    resolved.push({
      tournamentName: row.tournamentName,
      roundLabel: row.roundLabel,
      linkHref: row.linkHref,
      format: row.format,
      editionId: row.editionId,
      dedupKey: row.dedupKey,
      player1: {
        id: row.player1Id,
        displayName: row.player1Name,
        country: row.player1Country,
        seed: row.player1Seed,
        setGames: player1Live.setGames,
        currentPoint: player1Live.currentPoint,
        serving: player1Live.serving,
      },
      player2: {
        id: row.player2Id,
        displayName: row.player2Name,
        country: row.player2Country,
        seed: row.player2Seed,
        setGames: player2Live.setGames,
        currentPoint: player2Live.currentPoint,
        serving: player2Live.serving,
      },
    });
  }

  return resolved;
}
