import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { h2hNarratives } from "@/db/schema";
import type { H2HViewData } from "@/components/h2h/H2HView";

const MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Por debajo de esto no hay nada que contar que no diga ya la propia tabla. */
const MIN_MEETINGS = 2;
/** Corte de seguridad: si el modelo se enrolla, se descarta en vez de publicarlo. */
const MAX_CHARS = 420;
const TIMEOUT_MS = 8000;

/**
 * Los hechos se calculan aquí, no los deduce el modelo. Se le pasa este objeto ya
 * masticado y su único trabajo es redactarlo: si le mandáramos los partidos en crudo
 * pidiéndole conclusiones, acabaría inventando un dato y la web publicaría algo falso
 * sobre un jugador real como si fuera redacción propia.
 */
/**
 * Cada cifra va con un nombre que dice exactamente qué cuenta. La primera versión
 * pasaba cadenas ya formateadas ("Jirafalox 1-0 Franky") y el modelo las reinterpretó
 * como sets ganados, inventándose una frase entera. Con claves explícitas y valores
 * numéricos no hay margen para esa lectura.
 */
type MatchWinsByPlayer = Record<string, number>;

/**
 * Los códigos de ronda ('F', 'S', 'R2') se leen fatal en prosa — el modelo escribía
 * cosas como "the 2023 Indian Wells round". Las rondas previas a cuartos se dejan como
 * "an early round" a propósito: 'R1' significa cosas distintas en un cuadro de 8 que en
 * uno de 128, y no hay forma de decir cuál sin arriesgarse a exagerar.
 */
const ROUND_IN_PROSE: Record<string, string> = {
  F: "the final",
  S: "the semi-finals",
  Q: "the quarter-finals",
};

function roundInProse(round: string): string {
  if (ROUND_IN_PROSE[round]) return ROUND_IN_PROSE[round];
  if (round.startsWith("Q")) return "qualifying";
  return "an early round";
}

interface H2HFacts {
  playerA: string;
  playerB: string;
  totalMatchesPlayedAgainstEachOther: number;
  matchesWonByEachPlayer: MatchWinsByPlayer;
  playerLeadingOverall: string | null;
  firstEverMeeting: { year: number; tournament: string; wonBy: string };
  mostRecentMeeting: {
    year: number;
    tournament: string;
    round: string;
    wonBy: string;
    score: string | null;
  };
  currentWinStreak: { player: string; consecutiveMatchesWon: number } | null;
  matchesWonPerSeason: { season: number; matchesWonByEachPlayer: MatchWinsByPlayer }[];
  matchesWonBySurface: Record<string, MatchWinsByPlayer>;
  matchesWonByTournamentCategory: Record<string, MatchWinsByPlayer>;
  matchesWonInFinalsAgainstEachOther: MatchWinsByPlayer | null;
  currentTourRanking: Record<string, string>;
  careerTitlesOnTour: Record<string, number>;
}

function buildFacts(data: H2HViewData): H2HFacts | null {
  const { player1: a, player2: b, breakdown, history, stats1, stats2 } = data;
  if (history.length < MIN_MEETINGS) return null;

  const nameA = a.displayName;
  const nameB = b.displayName;
  const wins = (p1: number, p2: number): MatchWinsByPlayer => ({ [nameA]: p1, [nameB]: p2 });

  const first = history[history.length - 1];
  const last = history[0];
  const finals = breakdown.byRound.find((r) => r.label === "F");

  return {
    playerA: nameA,
    playerB: nameB,
    totalMatchesPlayedAgainstEachOther: history.length,
    matchesWonByEachPlayer: wins(data.player1Wins, data.player2Wins),
    playerLeadingOverall:
      data.player1Wins === data.player2Wins
        ? null
        : data.player1Wins > data.player2Wins
          ? nameA
          : nameB,
    firstEverMeeting: {
      year: first.year,
      tournament: first.eventName,
      wonBy: first.winnerName,
    },
    mostRecentMeeting: {
      year: last.year,
      tournament: last.eventName,
      round: roundInProse(last.round),
      wonBy: last.winnerName,
      score: last.scoreRaw,
    },
    currentWinStreak:
      breakdown.streakCount > 1 && breakdown.streakPlayerId !== null
        ? {
            player: breakdown.streakPlayerId === a.id ? nameA : nameB,
            consecutiveMatchesWon: breakdown.streakCount,
          }
        : null,
    matchesWonPerSeason: breakdown.byYear.map((y) => ({
      season: Number(y.label),
      matchesWonByEachPlayer: wins(y.player1Wins, y.player2Wins),
    })),
    matchesWonBySurface: Object.fromEntries(
      breakdown.bySurface.map((s) => [s.label, wins(s.player1Wins, s.player2Wins)]),
    ),
    matchesWonByTournamentCategory: Object.fromEntries(
      breakdown.byCategory.map((c) => [c.label, wins(c.player1Wins, c.player2Wins)]),
    ),
    matchesWonInFinalsAgainstEachOther: finals
      ? wins(finals.player1Wins, finals.player2Wins)
      : null,
    currentTourRanking: {
      [nameA]: a.currentRank ? `#${a.currentRank}` : "unranked",
      [nameB]: b.currentRank ? `#${b.currentRank}` : "unranked",
    },
    careerTitlesOnTour: {
      [nameA]: stats1.careerTitles,
      [nameB]: stats2.careerTitles,
    },
  };
}

/**
 * Red de seguridad determinista contra cifras inventadas: toda cifra que aparezca en el
 * texto tiene que existir en los hechos que le pasamos. No cubre todo (una afirmación
 * sin números se escapa), pero corta en seco el fallo más probable y más vergonzoso.
 */
function everyNumberIsBackedByFacts(narrative: string, facts: H2HFacts): boolean {
  const allowed = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number") allowed.add(String(value));
    else if (typeof value === "string") for (const n of value.match(/\d+/g) ?? []) allowed.add(n);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(facts);

  return (narrative.match(/\d+/g) ?? []).every((n) => allowed.has(n));
}

const SYSTEM_PROMPT = `You write a single short paragraph of commentary about a rivalry between two players on an online tennis tour.

The page already shows, right next to your text: the overall head-to-head record, both current rankings, and a table of every meeting. Repeating any of those is worthless. Your job is to point out the thing a reader would miss by looking at the raw numbers.

Look for, in this order of interest:
- A trend that reversed: use perSeason to see whether the player who leads overall has stopped winning recently, or vice versa.
- A long current streak that contradicts the overall record.
- A surface or category split that goes against the overall record.
- A lopsided record in finals specifically.
- Failing all that, the most recent meeting and what it settled.

Rules:
- Use ONLY the facts in the JSON. Never invent or estimate a number, name, year, tournament or event. Every figure you write must appear in the JSON.
- Every count in the JSON is MATCHES WON. You know nothing about sets, games, tie-breaks or points, except the single final score string of the most recent meeting. Never write a claim about sets or games.
- Never open by stating the overall record.
- Refer to players by name only. Never use he, she, him, her, his or hers — these are usernames and you do not know who is behind them.
- 2 to 3 sentences, 55 words maximum. If only one thing is worth saying, write one sentence.
- Neutral sports-desk tone. Plain prose: no headings, no bullets, no markdown, no quotation marks.
- Never mention data, statistics, records, JSON, analysis, or that you are a model.

Good: "Madferit has taken the last two meetings, including the 2026 Miami final, after losing the first four. The turn came on hard courts, where Jirafalox had won every previous meeting."
Bad: "Jirafalox leads Madferit 4-2. Jirafalox is ranked 1 and Madferit 2." — that is all already on screen.`;

async function callGroq(facts: H2HFacts, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 180,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const text = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]
      ?.message?.content;
    if (typeof text !== "string") return null;

    const clean = text.trim().replace(/^["']|["']$/g, "");
    if (clean.length === 0 || clean.length > MAX_CHARS) return null;
    if (!everyNumberIsBackedByFacts(clean, facts)) return null;
    return clean;
  } catch {
    // Timeout, red caída, respuesta ilegible: el bloque simplemente no se pinta.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Devuelve el párrafo del enfrentamiento, de caché si sigue vigente. Nunca lanza: si
 * algo falla, devuelve null y la sección no aparece.
 */
export async function getH2HNarrative(data: H2HViewData): Promise<string | null> {
  const facts = buildFacts(data);
  if (!facts) return null;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const lowPlayerId = Math.min(data.player1.id, data.player2.id);
  const highPlayerId = Math.max(data.player1.id, data.player2.id);
  // Cambia en cuanto vuelvan a jugar, y solo entonces.
  const fingerprint = `${data.history.length}:${Math.max(...data.history.map((h) => h.matchId))}`;

  try {
    const [cached] = await db
      .select({ narrative: h2hNarratives.narrative, fingerprint: h2hNarratives.fingerprint })
      .from(h2hNarratives)
      .where(
        and(
          eq(h2hNarratives.lowPlayerId, lowPlayerId),
          eq(h2hNarratives.highPlayerId, highPlayerId),
        ),
      );
    if (cached && cached.fingerprint === fingerprint) return cached.narrative;

    const narrative = await callGroq(facts, apiKey);
    if (!narrative) return cached?.narrative ?? null;

    await db
      .insert(h2hNarratives)
      .values({ lowPlayerId, highPlayerId, fingerprint, narrative, model: MODEL })
      .onConflictDoUpdate({
        target: [h2hNarratives.lowPlayerId, h2hNarratives.highPlayerId],
        set: { fingerprint, narrative, model: MODEL, createdAt: sql`now()` },
      });

    return narrative;
  } catch {
    return null;
  }
}
