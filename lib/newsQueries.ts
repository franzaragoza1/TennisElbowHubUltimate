import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { discordInterviewThreads, editions, events, news, newsPlayers, players } from "@/db/schema";

export interface NewsCardData {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  surface: string | null;
  eventName: string | null;
  editionId: number | null;
  taggedPlayers: { id: number; displayName: string; country: string | null }[];
  author: string | null;
}

interface NewsRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  image_url: string | null;
  published_at: Date | string | null;
  edition_id: number | null;
  surface: string | null;
  event_name: string | null;
  author: string | null;
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

async function attachTags(rows: NewsRow[]): Promise<NewsCardData[]> {
  if (rows.length === 0) return [];

  const tags = await db
    .select({
      newsId: newsPlayers.newsId,
      id: players.id,
      displayName: players.displayName,
      country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
    })
    .from(newsPlayers)
    .innerJoin(players, eq(players.id, newsPlayers.playerId))
    .where(
      sql`${newsPlayers.newsId} IN (${sql.join(
        rows.map((r) => sql`${r.id}`),
        sql`, `,
      )})`,
    );

  const byNews = new Map<number, NewsCardData["taggedPlayers"]>();
  for (const t of tags) {
    const list = byNews.get(t.newsId) ?? [];
    list.push({ id: t.id, displayName: t.displayName, country: t.country });
    byNews.set(t.newsId, list);
  }

  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    category: r.category,
    imageUrl: r.image_url,
    publishedAt: r.published_at ? new Date(r.published_at) : null,
    surface: r.surface,
    eventName: r.event_name,
    editionId: r.edition_id === null ? null : Number(r.edition_id),
    taggedPlayers: byNews.get(Number(r.id)) ?? [],
    author: r.author,
  }));
}

const SELECT_PUBLISHED = sql`
  SELECT n.id, n.slug, n.title, n.excerpt, n.category, n.image_url, n.published_at,
         n.edition_id, n.author, e.surface, ev.display_name AS event_name
  FROM news n
  LEFT JOIN editions e ON e.id = n.edition_id
  LEFT JOIN events ev ON ev.id = e.event_id
  WHERE n.status = 'published'
`;

export async function getPublishedNews(limit?: number): Promise<NewsCardData[]> {
  const result = await db.execute(
    limit === undefined
      ? sql`${SELECT_PUBLISHED} ORDER BY n.published_at DESC NULLS LAST, n.id DESC`
      : sql`${SELECT_PUBLISHED} ORDER BY n.published_at DESC NULLS LAST, n.id DESC LIMIT ${limit}`,
  );
  return attachTags(rowsOf<NewsRow>(result));
}

/** Igual que `getPublishedNews`, pero solo artículos con al menos un jugador
 * etiquetado — pedido explícito (2026-09-17) para el carril de `/players`: mucho
 * contenido editorial es comentario general del tour sin ningún jugador de por medio
 * (parches, calendario...), y esta sección es justo la contraria — "noticias sobre
 * jugadores", en una página que ya trata de jugadores. */
export async function getPublishedNewsWithTaggedPlayers(limit: number): Promise<NewsCardData[]> {
  const result = await db.execute(sql`
    ${SELECT_PUBLISHED}
      AND EXISTS (SELECT 1 FROM news_players np WHERE np.news_id = n.id)
    ORDER BY n.published_at DESC NULLS LAST, n.id DESC
    LIMIT ${limit}
  `);
  return attachTags(rowsOf<NewsRow>(result));
}

/** Noticias donde se ha etiquetado a un jugador — la ficha de jugador las lista. */
export async function getNewsForPlayer(playerId: number): Promise<NewsCardData[]> {
  const result = await db.execute(sql`
    ${SELECT_PUBLISHED}
      AND n.id IN (SELECT news_id FROM news_players WHERE player_id = ${playerId})
    ORDER BY n.published_at DESC NULLS LAST, n.id DESC
  `);
  return attachTags(rowsOf<NewsRow>(result));
}

export interface InterviewTranscript {
  playerName: string;
  opponentName: string;
  qa: { question: string; answer: string }[];
}

export interface NewsArticle extends NewsCardData {
  body: string;
  /** Solo en un artículo nacido de una entrevista real (news.interview_thread_id, ver
   * lib/discordBot/interactions/interviewMessage.ts) — la página del artículo la
   * enseña debajo del cuerpo. null en cualquier otro artículo, o si el hilo ya no
   * tiene ninguna respuesta guardada. */
  interviewTranscript: InterviewTranscript | null;
}

async function getInterviewTranscript(threadId: number): Promise<InterviewTranscript | null> {
  const player = players;
  const [row] = await db
    .select({
      playerName: player.displayName,
      opponentId: discordInterviewThreads.opponentId,
      qa: discordInterviewThreads.qa,
    })
    .from(discordInterviewThreads)
    .innerJoin(player, eq(player.id, discordInterviewThreads.playerId))
    .where(eq(discordInterviewThreads.id, threadId));
  if (!row || row.qa.length === 0) return null;

  const [opponent] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, row.opponentId));

  return { playerName: row.playerName, opponentName: opponent?.displayName ?? "their opponent", qa: row.qa };
}

export async function getNewsBySlug(slug: string): Promise<NewsArticle | null> {
  const [story] = await db
    .select()
    .from(news)
    .where(and(eq(news.slug, slug), eq(news.status, "published")));
  if (!story) return null;

  let surface: string | null = null;
  let eventName: string | null = null;
  if (story.editionId) {
    const [edition] = await db
      .select({ surface: editions.surface, eventName: events.displayName })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .where(eq(editions.id, story.editionId));
    surface = edition?.surface ?? null;
    eventName = edition?.eventName ?? null;
  }

  const [card] = await attachTags([
    {
      id: story.id,
      slug: story.slug,
      title: story.title,
      excerpt: story.excerpt,
      category: story.category,
      image_url: story.imageUrl,
      published_at: story.publishedAt,
      edition_id: story.editionId,
      surface,
      event_name: eventName,
      author: story.author,
    },
  ]);

  const interviewTranscript = story.interviewThreadId ? await getInterviewTranscript(story.interviewThreadId) : null;

  return { ...card, body: story.body, interviewTranscript };
}

export async function getPublishedSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: news.slug })
    .from(news)
    .where(eq(news.status, "published"))
    .orderBy(desc(news.publishedAt));
  return rows.map((r) => r.slug);
}
