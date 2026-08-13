import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // 'mana'
  name: text("name").notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  country: text("country"),
  character: text("character"), // sin fuente conocida todavía, ver docs/estructura.md
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerAliases = pgTable(
  "player_aliases",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(), // el p=/u= de Mana Games
    displayName: text("display_name").notNull(),
  },
  (t) => [unique().on(t.sourceId, t.externalId)],
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name").notNull(),
  },
  (t) => [unique().on(t.sourceId, t.normalizedName)],
);

export const editions = pgTable(
  "editions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(), // el Trn=
    year: integer("year").notNull(),
    isoWeek: integer("iso_week"),
    weekStartDate: date("week_start_date"),
    surface: text("surface").notNull(), // texto libre, ver decisiones.md
    category: text("category").notNull(), // texto libre, ver decisiones.md
    competition: text("competition").notNull(), // 'Singles' (único valor visto)
    drawSize: integer("draw_size").notNull(),
    queueCount: integer("queue_count"),
    queueCapacity: integer("queue_capacity"),
    seeds: integer("seeds"),
    officialTopicUrl: text("official_topic_url"),
  },
  (t) => [unique().on(t.sourceId, t.externalId)],
);

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  editionId: integer("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "cascade" }),
  round: text("round").notNull(), // 'R1'..'R4','Q','S','F','Q1','Q2','Qualified' — texto libre
  player1Id: integer("player1_id").references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id),
  player1Seed: integer("player1_seed"), // cabeza de serie, si la tenía
  player2Seed: integer("player2_seed"),
  winnerId: integer("winner_id").references(() => players.id),
  outcome: text("outcome").notNull(), // 'played' | 'walkover' | 'retired' | 'disqualified' | 'random' ("Random Luck", jerga TE4 para un cruce que no se llegó a jugar)
  scoreRaw: text("score_raw"),
  playedAt: timestamp("played_at"), // nullable, sin rellenar en el backfill histórico
});

export const sets = pgTable("sets", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  winnerGames: integer("winner_games").notNull(),
  loserGames: integer("loser_games").notNull(),
  tiebreakLoserPoints: integer("tiebreak_loser_points"), // "7(5)" -> 5
});

export const matchStats = pgTable("match_stats", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  aces: integer("aces"),
  doubleFaults: integer("double_faults"),
  firstServeIn: integer("first_serve_in"),
  breakPointsWon: integer("break_points_won"),
  breakPointsFaced: integer("break_points_faced"),
});

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    isoYear: integer("iso_year").notNull(),
    isoWeek: integer("iso_week").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    rank: integer("rank").notNull(),
    points: integer("points").notNull(),
    moved: integer("moved").notNull().default(0), // '--' -> 0
    smallTrn: integer("small_trn"), // columna sin explicar en la fuente, se guarda opaca
  },
  (t) => [unique().on(t.sourceId, t.isoYear, t.isoWeek, t.playerId)],
);

/**
 * Noticias de portada, escritas a mano desde /admin. No vienen de la fuente: son
 * contenido propio, lo único del sitio que no se importa de Mana Games.
 *
 * `status` en vez de borrar: un borrador se guarda sin salir a portada.
 */
export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(), // resumen corto para la tarjeta del carril
  body: text("body").notNull(),
  category: text("category").notNull(), // 'REPORT' | 'ANNOUNCEMENT' | 'RESULTS' | 'FEATURE'
  imageUrl: text("image_url"), // opcional, por URL: no hay almacenamiento de ficheros
  editionId: integer("edition_id").references(() => editions.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // 'draft' | 'published'
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Jugadores etiquetados en una noticia. Tabla aparte y no una columna en `news` porque
 * una crónica menciona normalmente a los dos de la final, y porque la ficha de jugador
 * necesita la consulta inversa ("noticias donde sale este jugador").
 */
export const newsPlayers = pgTable(
  "news_players",
  {
    id: serial("id").primaryKey(),
    newsId: integer("news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.newsId, t.playerId)],
);

/**
 * Caché del párrafo de contexto que se muestra en el H2H. Se guarda porque hay ~152.000
 * parejas posibles y el texto solo cambia cuando esos dos vuelven a jugar: `fingerprint`
 * es justo eso (número de cruces + id del último), así que un cruce nuevo invalida la
 * entrada y cualquier otra visita la reutiliza.
 *
 * La pareja se guarda normalizada (lowId < highId) para que (A,B) y (B,A) sean la misma
 * fila.
 */
export const h2hNarratives = pgTable(
  "h2h_narratives",
  {
    id: serial("id").primaryKey(),
    lowPlayerId: integer("low_player_id")
      .notNull()
      .references(() => players.id),
    highPlayerId: integer("high_player_id")
      .notNull()
      .references(() => players.id),
    fingerprint: text("fingerprint").notNull(),
    narrative: text("narrative").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.lowPlayerId, t.highPlayerId)],
);

export const importRuns = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id")
    .notNull()
    .references(() => sources.id),
  kind: text("kind").notNull(), // 'tournament' | 'ranking'
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // 'success' | 'partial' | 'failed'
  filesProcessed: integer("files_processed").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  errors: jsonb("errors"),
});
