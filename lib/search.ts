import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, matchVideos, news, players, sources } from "@/db/schema";

// Ediciones espejo de Finals (lib/finals/mirror.ts, `sources.slug = 'xkt'`) — existen
// solo para que un partido de Finals cuente en agregados (H2H, forma reciente,
// actividad de temporada), nunca para navegarlas como si fueran un torneo real: su
// `editions.id` no tiene un cuadro de eliminación que enseñar en /tournaments/[id]
// (fase de grupos "RR-A"/"RR-B" que ese cuadro no sabe dibujar). Ya tienen su propia
// página real en /finals/[id] — se excluyen aquí para no ofrecer un enlace roto desde
// la búsqueda; nunca se filtran los partidos DE VERDAD que las alimentan (los que
// siguen viviendo bajo `finals_matches`, fuera del alcance de esta búsqueda).
const xktMirroredEditionIds = db
  .select({ id: editions.id })
  .from(editions)
  .innerJoin(sources, eq(sources.id, editions.sourceId))
  .where(eq(sources.slug, "xkt"));

const MAX_RESULTS_PER_CATEGORY = 5;

export interface SearchPlayerResult {
  id: number;
  displayName: string;
  country: string | null;
  avatarUrl: string | null;
}

export interface SearchTournamentResult {
  editionId: number;
  eventName: string;
  year: number;
  category: string;
}

export interface SearchNewsResult {
  slug: string;
  title: string;
  category: string;
}

export interface SearchVideoResult {
  youtubeVideoId: string;
  title: string;
}

export interface SearchMatchResult {
  editionId: number;
  eventName: string;
  year: number;
  round: string;
  player1Name: string;
  player2Name: string;
  scoreRaw: string | null;
}

export interface SearchResults {
  players: SearchPlayerResult[];
  tournaments: SearchTournamentResult[];
  news: SearchNewsResult[];
  videos: SearchVideoResult[];
  matches: SearchMatchResult[];
}

/** Escapa los comodines de `ILIKE` en lo que escribe el usuario — sin esto, alguien
 * buscando "50%" o "a_b" dispararía comodines que no pidió. */
function likeTerm(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Busca en todo lo público del sitio a la vez. Cada categoría se recorta a
 * `MAX_RESULTS_PER_CATEGORY` — esto alimenta un desplegable de búsqueda, no una
 * página de resultados paginada. */
export async function searchSite(query: string): Promise<SearchResults> {
  const term = likeTerm(query);
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  const [playerRows, tournamentRows, newsRows, videoRows, matchRows] = await Promise.all([
    db
      .select({
        id: players.id,
        displayName: players.displayName,
        country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .where(ilike(players.displayName, term))
      .orderBy(players.displayName)
      .limit(MAX_RESULTS_PER_CATEGORY),

    db
      .select({
        editionId: editions.id,
        eventName: events.displayName,
        year: editions.year,
        category: editions.category,
      })
      .from(editions)
      .innerJoin(events, eq(editions.eventId, events.id))
      .where(and(ilike(events.displayName, term), notInArray(editions.id, xktMirroredEditionIds)))
      .orderBy(desc(editions.year), desc(editions.isoWeek))
      .limit(MAX_RESULTS_PER_CATEGORY),

    db
      .select({ slug: news.slug, title: news.title, category: news.category })
      .from(news)
      .where(and(eq(news.status, "published"), ilike(news.title, term)))
      .orderBy(desc(news.publishedAt))
      .limit(MAX_RESULTS_PER_CATEGORY),

    db
      .select({ youtubeVideoId: matchVideos.youtubeVideoId, title: matchVideos.title })
      .from(matchVideos)
      .where(and(inArray(matchVideos.status, ["auto", "confirmed"]), ilike(matchVideos.title, term)))
      .orderBy(desc(matchVideos.publishedAt), desc(matchVideos.createdAt))
      .limit(MAX_RESULTS_PER_CATEGORY),

    db
      .select({
        editionId: matches.editionId,
        eventName: events.displayName,
        year: editions.year,
        round: matches.round,
        player1Name: p1.displayName,
        player2Name: p2.displayName,
        scoreRaw: matches.scoreRaw,
      })
      .from(matches)
      .innerJoin(editions, eq(matches.editionId, editions.id))
      .innerJoin(events, eq(editions.eventId, events.id))
      .innerJoin(p1, eq(p1.id, matches.player1Id))
      .innerJoin(p2, eq(p2.id, matches.player2Id))
      .where(
        and(
          or(ilike(p1.displayName, term), ilike(p2.displayName, term)),
          notInArray(matches.editionId, xktMirroredEditionIds),
        ),
      )
      .orderBy(desc(editions.year), desc(editions.isoWeek))
      .limit(MAX_RESULTS_PER_CATEGORY),
  ]);

  return {
    players: playerRows,
    tournaments: tournamentRows,
    news: newsRows,
    videos: videoRows,
    matches: matchRows,
  };
}
