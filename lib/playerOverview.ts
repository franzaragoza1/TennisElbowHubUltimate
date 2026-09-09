import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { discordInterviewThreads, playerBuilds, playerOverviews, rankingSnapshots } from "@/db/schema";
import { getRecentFormLines } from "./newsGeneration/recentForm";
import { getPalmares } from "./h2hStats";
import { myStatsWindowCondition } from "./statsQueries";
import { DEFAULT_MY_STATS_WINDOW } from "./myStatsWindow";

// Mismo modelo que el resto de llamadas a Groq de este repo — "llama-3.3-70b-versatile"
// desapareció de su catálogo (ver lib/newsGeneration/draft.ts), openai/gpt-oss-120b es
// el que quedó vigente.
const MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;
// "gpt-oss-120b" es un modelo "de razonamiento": gasta parte del presupuesto de
// tokens pensando en un campo `reasoning` aparte ANTES de escribir el JSON final (ver
// lib/newsGeneration/interviewQuestions.ts — ahí 150 fallaba siempre y 600 nunca,
// para una respuesta bastante más corta que un párrafo + 2-3 consejos). 1000 bastaba
// cuando la respuesta era un párrafo + UNA lista de tips — al pasar a párrafo + DOS
// listas (strengths y downsides) volvió a pasar exactamente lo mismo: Groq devolvía
// 400 "json_validate_failed" con `failed_generation` vacío (el modelo agotaba el
// presupuesto pensando, sin llegar a escribir el JSON) — bug real reportado, sección
// "How you're doing" desaparecida entera para jugadores sin caché previa que cubriera
// el fallo. Generoso a propósito desde el principio en vez de volver a descubrir el
// mismo fallo silencioso una tercera vez.
const MAX_TOKENS = 2000;
// Sube esto cuando SYSTEM_PROMPT cambie de forma que de verdad cambie el tono/
// contenido del resultado (p.ej. el paso a segunda persona), O cuando cambie cómo se
// calculan los HECHOS que se le mandan (p.ej. el orden de "forma reciente" —
// lib/newsGeneration/recentForm.ts, bug real: unas Finals de la temporada pasada
// salían como el partido más reciente) — el fingerprint no tiene ninguna otra forma
// de saber que el texto ya cacheado se generó con datos/instrucciones distintas, así
// que sin esto una fila cacheada antes del cambio se serviría tal cual indefinidamente
// hasta que el jugador jugara un partido nuevo.
const PROMPT_VERSION = 6;
const MAX_OVERVIEW_CHARS = 500;
const MAX_ITEM_CHARS = 140;
const MAX_ITEMS = 3;
// Mismo mínimo que lib/statsQueries.ts (leaderboards) — por debajo de esto un
// porcentaje real (p.ej. 100% de primeros saques con un solo partido jugado) es
// ruido, no una tendencia real de la que dar un consejo.
const MIN_STATS_MATCHES = 5;

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/**
 * Los hechos se calculan aquí, no los deduce el modelo — mismo criterio que
 * lib/h2hNarrative.ts::buildFacts: si le mandáramos partidos en crudo pidiéndole
 * conclusiones, acabaría inventando un dato sobre un jugador real.
 */
interface PlayerOverviewFacts {
  playerName: string;
  /** Más reciente primero, ver lib/newsGeneration/recentForm.ts. Vacío si no tiene
   * historial todavía. */
  recentMatches: string[];
  currentRanking: string; // "#12" | "unranked"
  /** Su snapshot anterior más reciente en el histórico, sea o no la semana justo
   * antes (un jugador inactivo puede llevar meses sin snapshot nuevo) — null si no
   * hay ninguno más que el actual, o si nunca ha tenido ranking. */
  previousRanking: string | null;
  careerTitles: number;
  /** Última entrevista COMPLETADA del bot de Discord, si tiene alguna — la mayoría de
   * jugadores no tendrán ninguna, y la generación tiene que funcionar igual sin
   * esto. */
  recentInterviewAnswers: { question: string; answer: string }[] | null;
  /** Estadísticas reales de saque/resto (lib/statsQueries.ts, mismas columnas de
   * `match_stats`) — null si tiene menos de MIN_STATS_MATCHES partidos con
   * estadística registrada. Sin esto, los "consejos" no tenían ningún número real
   * del que colgar una observación concreta y salían genéricos (bug real reportado,
   * "this is not good advice") — con esto, el prompt puede señalar cuál de estos
   * números es comparativamente el más débil. */
  serveReturnStats: ServeReturnStats | null;
  /** La build marcada "in use" (db/schema.ts::playerBuilds.inUse), si tiene alguna —
   * pedido explícito del propietario. Solo el nombre/arquetipo/rasgo de aceleración:
   * son los únicos campos que tiene sentido citar como color de la ficha ("juegas de
   * Bulldog"), a diferencia de los stats numéricos del build (0-100, coste de puntos
   * in-game), que no son una medida de rendimiento real y mezclarlos con
   * serveReturnStats (porcentajes de partidos jugados de verdad) confundiría al
   * modelo sobre qué número es cuál. */
  currentBuild: { name: string; archetype: string | null; accelerationTrait: string | null } | null;
}

interface MatchAggRow {
  match_count: number;
  last_match_id: number | null;
}

interface ServeReturnStats {
  matchesCounted: number;
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  returnPointsWonPct: number | null;
  breakPointsWonPct: number | null;
  breakPointsSavedPct: number | null;
}

interface StatsAggRow {
  matches_counted: number;
  first_serve_pct: number | null;
  first_serve_won_pct: number | null;
  second_serve_won_pct: number | null;
  return_points_won_pct: number | null;
  break_points_won_pct: number | null;
  break_points_saved_pct: number | null;
}

/** Mismo self-join que lib/statsQueries.ts::getPressureLeaders para "break points
 * saved" (no es una columna propia — se deriva de la fila de estadísticas del RIVAL
 * en el mismo partido, ver el comentario de esa función). Acotado a la misma ventana
 * por defecto que "My Stats" (DEFAULT_MY_STATS_WINDOW, lib/myStatsWindow.ts) —
 * ANTES era sin filtro de periodo (carrera entera), y eso hacía que este mismo dato
 * ("1st serve won %") mostrara un número distinto aquí que en la tarjeta "My Stats"
 * de debajo, en la misma página — bug real reportado ("Text in strength didnt get
 * updated", en realidad dos ventanas de tiempo distintas para el mismo nombre de
 * stat). Sin filtro de superficie/rival: esto sigue siendo contexto para un párrafo
 * de ficha, no un leaderboard competitivo. `matchesCounted` se devuelve SIEMPRE
 * (incluso por debajo del mínimo) para poder invalidar la caché en cuanto cruce el
 * umbral. */
async function getServeReturnStats(playerId: number): Promise<{ matchesCounted: number; stats: ServeReturnStats | null }> {
  const result = await db.execute(sql`
    SELECT
      count(*)::int AS matches_counted,
      round(100.0 * sum(ms.first_serve_in) / nullif(sum(ms.first_serve_attempted), 0), 1)::float8 AS first_serve_pct,
      round(100.0 * sum(ms.first_serve_points_won) / nullif(sum(ms.first_serve_points_played), 0), 1)::float8 AS first_serve_won_pct,
      round(100.0 * sum(ms.second_serve_points_won) / nullif(sum(ms.second_serve_points_played), 0), 1)::float8 AS second_serve_won_pct,
      round(100.0 * sum(ms.return_points_won) / nullif(sum(ms.return_points_played), 0), 1)::float8 AS return_points_won_pct,
      round(100.0 * sum(ms.break_points_won) / nullif(sum(ms.break_points_faced), 0), 1)::float8 AS break_points_won_pct,
      round(100.0 * (sum(om.break_points_faced) - sum(om.break_points_won)) / nullif(sum(om.break_points_faced), 0), 1)::float8 AS break_points_saved_pct
    FROM match_stats ms
    JOIN matches m ON m.id = ms.match_id
    JOIN editions e ON e.id = m.edition_id
    JOIN match_stats om ON om.match_id = ms.match_id AND om.player_id <> ms.player_id
    WHERE ms.player_id = ${playerId} AND ${myStatsWindowCondition(DEFAULT_MY_STATS_WINDOW)}
  `);
  const row = rowsOf<StatsAggRow>(result)[0];
  const matchesCounted = Number(row?.matches_counted ?? 0);
  if (!row || matchesCounted < MIN_STATS_MATCHES) return { matchesCounted, stats: null };

  return {
    matchesCounted,
    stats: {
      matchesCounted,
      firstServePct: row.first_serve_pct,
      firstServeWonPct: row.first_serve_won_pct,
      secondServeWonPct: row.second_serve_won_pct,
      returnPointsWonPct: row.return_points_won_pct,
      breakPointsWonPct: row.break_points_won_pct,
      breakPointsSavedPct: row.break_points_saved_pct,
    },
  };
}

async function buildFacts(
  playerId: number,
  playerName: string,
  serveReturnStats: ServeReturnStats | null,
): Promise<PlayerOverviewFacts> {
  const [recentMatches, rankRows, titles, interviewRows, buildRows] = await Promise.all([
    getRecentFormLines(playerId, new Date()),
    db
      .select({ rank: rankingSnapshots.rank })
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.playerId, playerId), eq(rankingSnapshots.kind, "official")))
      .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek))
      .limit(2),
    getPalmares(playerId),
    db
      .select({ qa: discordInterviewThreads.qa })
      .from(discordInterviewThreads)
      .where(and(eq(discordInterviewThreads.playerId, playerId), eq(discordInterviewThreads.status, "completed")))
      .orderBy(desc(discordInterviewThreads.createdAt))
      .limit(1),
    db
      .select({ name: playerBuilds.name, archetype: playerBuilds.archetype, accelerationTrait: playerBuilds.accelerationTrait })
      .from(playerBuilds)
      .where(and(eq(playerBuilds.playerId, playerId), eq(playerBuilds.inUse, true)))
      .limit(1),
  ]);

  return {
    playerName,
    recentMatches,
    currentRanking: rankRows[0] ? `#${rankRows[0].rank}` : "unranked",
    previousRanking: rankRows[1] ? `#${rankRows[1].rank}` : null,
    careerTitles: titles.length,
    recentInterviewAnswers: interviewRows[0]?.qa.length ? interviewRows[0].qa : null,
    serveReturnStats,
    currentBuild: buildRows[0] ?? null,
  };
}

/** Misma red de seguridad determinista que lib/h2hNarrative.ts contra cifras
 * inventadas: toda cifra que aparezca en el texto tiene que existir en los hechos. */
function everyNumberIsBackedByFacts(text: string, facts: PlayerOverviewFacts): boolean {
  const allowed = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number") allowed.add(String(value));
    else if (typeof value === "string") for (const n of value.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(n);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(facts);
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(n));
}

const SYSTEM_PROMPT = `You write a short private "how you're doing" overview for a player's own account page on an online tennis tour, plus up to 3 strengths and up to 3 downsides. This is personal coaching feedback shown ONLY to that player, never on a public page — write directly TO them, in second person ("you", "your"), never in third person and never by name (playerName is given only so you know who you're talking to, not to address them as "Gyrmik sits at..." — write "You sit at..." instead).

THE OVERVIEW:
- 2-4 sentences, 70 words maximum. Plain prose: no headings, no bullets, no markdown, no quotation marks.
- Second person throughout ("you've climbed to #7...", not "Gyrmik has climbed to #7...").
- Point out something you'd miss from the rank number alone — a specific recent result, a title, a streak, a change in form. Never just restate currentRanking as a sentence.
- If recentMatches is empty, write a short neutral welcome instead of commentary on form that doesn't exist yet.
- Each entry in recentMatches already ends with the correct round label (QF, SF, F, R16...) — use it exactly as written, never rename, reinterpret, or guess a different round from it (e.g. never call a "QF" result a "fourth round" run).
- A result tagged "(disqualified)" or "(walkover)" was never actually competed — never present a win like that as an achievement, a good result, or evidence of good form, in the overview or in either list. It's fine to skip it entirely and reason about the rest of recentMatches instead.

STRENGTHS and DOWNSIDES — read this carefully, this is what most often goes wrong:
- Second person, like real coaching feedback spoken directly to the player ("Your return points won sits at 44%...", not "Their return points...").
- Every single item, in EITHER list, MUST cite one specific number or one specific named opponent/tournament/score that appears in the facts. An item with no concrete detail traceable to the JSON is not acceptable, no matter how plausible it sounds as generic commentary.
- Strengths point at what's comparatively strong: a good result, a title, a winning streak, or — if serveReturnStats is present — whichever of its numbers is comparatively the best next to the others given.
- Downsides point at what's comparatively weak: a tough loss, a cold streak, or — if serveReturnStats is present — whichever of its numbers is comparatively the weakest (e.g. a second-serve-points-won percentage well below the first-serve one; a low breakPointsSavedPct points at games leaking away from break point down).
- You may reason about which numbers are comparatively better/worse, but never invent a number, a percentile, or a tour-average comparison that isn't in the JSON.
- If serveReturnStats is absent, ground both lists in recentMatches instead — specific opponents beaten or lost to, specific score lines, a pattern across the listed results.
- Never write an item that would fit literally any player regardless of their facts ("keep up the momentum", "target tournaments where you've had success before", "stay focused", "work on your weaknesses"). If there is no concrete, specific-to-this-player detail to hang an item on, leave that list SHORTER (even empty) rather than pad it with a generic entry — this applies independently to each list, so it's fine for one to have entries and the other to be empty.
- One sentence each, 20 words maximum.

Good strength (second person, cites a real, comparatively strong number): "Your first serve points won sits at 71% — clearly the sharpest part of your game right now."
Good downside (second person, cites a real, comparatively weak number): "Your second serve points won sits at 41%, well below the 63% you win on first serve — that gap is the clearest lever right now."
Bad item (third person, and says nothing this player's own facts didn't already make obvious): "Focus on maintaining the momentum from recent results."

GENERAL RULES:
- Use ONLY the facts in the JSON. Never invent or estimate a number, name, tournament, ranking, percentile, or streak.
- If recentInterviewAnswers is present, you may use it for color/flavor (something the player themselves said, e.g. "you mentioned..."), but never treat it as a new stat to build commentary on, and only if it's actually coherent with recentMatches — e.g. don't quote confidence about a tournament or opponent whose result the facts now contradict (a later loss, an early exit).
- If currentBuild is present, you may mention it once, briefly, as flavor (e.g. its archetype or acceleration trait) — never invent or cite a build stat number, and never claim the build explains a specific result.
- Neutral, encouraging, direct coaching tone — like a coach talking to their player, not a sports-desk reporter describing them.
- Never mention data, statistics, records, JSON, analysis, an interview, or that you are a model.
- Respond with ONLY a JSON object shaped exactly like {"overview": string, "strengths": string[], "downsides": string[]}. No other text.`;

interface GroqOverview {
  overview: string;
  strengths: string[];
  downsides: string[];
}

/** Cada lista es válida vacía (pedido explícito del prompt: mejor una lista corta que
 * un relleno genérico), pero nunca más larga que MAX_ITEMS ni con un ítem fuera del
 * límite de caracteres. */
function isValidItemList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_ITEMS && value.every((v) => typeof v === "string" && v.length > 0 && v.length <= MAX_ITEM_CHARS);
}

async function callGroq(facts: PlayerOverviewFacts, apiKey: string): Promise<GroqOverview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const text = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const { overview, strengths, downsides } = (parsed ?? {}) as { overview?: unknown; strengths?: unknown; downsides?: unknown };
    if (typeof overview !== "string" || overview.length === 0 || overview.length > MAX_OVERVIEW_CHARS) return null;
    if (!isValidItemList(strengths) || !isValidItemList(downsides)) return null;
    if (!everyNumberIsBackedByFacts([overview, ...strengths, ...downsides].join(" "), facts)) return null;

    return { overview, strengths, downsides };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface PlayerOverviewResult {
  overview: string;
  strengths: string[];
  downsides: string[];
}

/**
 * Devuelve el resumen de la ficha pública, de caché si sigue vigente. Nunca lanza: si
 * algo falla, devuelve null y la sección no aparece — mismo contrato que
 * lib/h2hNarrative.ts::getH2HNarrative.
 */
export async function getPlayerOverview(playerId: number, playerName: string): Promise<PlayerOverviewResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const { matchesCounted: statsMatchesCounted, stats: serveReturnStats } = await getServeReturnStats(playerId);

    const [facts, matchAggResult, interviewCountRow] = await Promise.all([
      buildFacts(playerId, playerName, serveReturnStats),
      db.execute(sql`
        SELECT count(*)::int AS match_count, max(id)::int AS last_match_id
        FROM matches
        WHERE player1_id = ${playerId} OR player2_id = ${playerId}
      `),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(discordInterviewThreads)
        .where(and(eq(discordInterviewThreads.playerId, playerId), eq(discordInterviewThreads.status, "completed"))),
    ]);

    const agg = rowsOf<MatchAggRow>(matchAggResult)[0];
    const matchCount = Number(agg?.match_count ?? 0);
    const lastMatchId = agg?.last_match_id ?? 0;
    const completedInterviewCount = interviewCountRow[0]?.count ?? 0;
    // `statsMatchesCounted` aparte de `matchCount`/`lastMatchId`: subir un MatchLog de
    // un partido YA existente no cambia ni el recuento de `matches` ni su último id
    // (esa fila ya estaba), pero sí añade estadísticas nuevas de las que colgar un
    // consejo — sin este componente, la caché no se enteraría del cambio. El propio
    // `currentBuild` entra tal cual (nombre/arquetipo/rasgo) en vez de un id+fecha
    // aparte: cambiar de build en uso, o solo renombrarla/cambiar su arquetipo,
    // invalida la caché igual, sin una consulta extra solo para eso.
    const build = facts.currentBuild;
    const fingerprint = `v${PROMPT_VERSION}:${matchCount}:${lastMatchId}:${facts.currentRanking}:${completedInterviewCount}:${statsMatchesCounted}:${build?.name ?? ""}:${build?.archetype ?? ""}:${build?.accelerationTrait ?? ""}`;

    const [cached] = await db
      .select({
        overview: playerOverviews.overview,
        strengths: playerOverviews.strengths,
        downsides: playerOverviews.downsides,
        fingerprint: playerOverviews.fingerprint,
      })
      .from(playerOverviews)
      .where(eq(playerOverviews.playerId, playerId));
    if (cached && cached.fingerprint === fingerprint) {
      return { overview: cached.overview, strengths: cached.strengths, downsides: cached.downsides };
    }

    const generated = await callGroq(facts, apiKey);
    if (!generated) {
      return cached ? { overview: cached.overview, strengths: cached.strengths, downsides: cached.downsides } : null;
    }

    await db
      .insert(playerOverviews)
      .values({
        playerId,
        fingerprint,
        overview: generated.overview,
        strengths: generated.strengths,
        downsides: generated.downsides,
        model: MODEL,
      })
      .onConflictDoUpdate({
        target: playerOverviews.playerId,
        set: {
          fingerprint,
          overview: generated.overview,
          strengths: generated.strengths,
          downsides: generated.downsides,
          model: MODEL,
          createdAt: sql`now()`,
        },
      });

    return generated;
  } catch {
    return null;
  }
}
