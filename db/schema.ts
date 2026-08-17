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
  // Nacionalidad mostrada en el sitio cuando difiere de `country` (p.ej. mal
  // capturada en el foro). NUNCA la toca el importador — `country` se resincroniza
  // en cada `npm run load` completo (scripts/load.ts::bulkUpdateCountry) y pisaría
  // cualquier corrección guardada ahí. Null = sin override, se usa `country` tal cual.
  countryOverride: text("country_override"),
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
    // Nullable: las Tour Finals (ver finalsEditions más abajo) no tienen una superficie
    // de pista real que reportar — nunca se inventa una (docs/decisiones.md).
    surface: text("surface"),
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
  // Posición real de arriba abajo dentro de SU RONDA en la rejilla fuente (ver
  // parsers/schemas.ts::MatchSchema.sortIndex). Nullable porque las filas ya
  // importadas antes de este campo no lo tienen — para esas, el orden sigue cayendo
  // en `id` (orden de inserción, ya fiable hasta ahora); las que se vuelvan a cargar sí
  // lo llevan. Ver docs/decisiones.md, bug de Cincinnati 2026 (Trn=2092).
  sortIndex: integer("sort_index"),
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

// Bye real, tal como aparece en el cuadro fuente (un jugador emparejado contra la
// celda "Bye" de una ronda concreta) — nunca tiene fila en `matches` (no es un
// partido), pero antes se descartaba del todo y el frontend tenía que ADIVINAR quién
// tuvo un bye y en qué ronda a partir de en qué ronda reaparece cada jugador. Esa
// adivinanza se rompe en cuadros irregulares (bug de Cincinnati 2026, Trn=2092, ver
// docs/decisiones.md): un jugador que entra directo en una ronda tardía sin haber
// jugado nunca antes es indistinguible de "tuvo un bye justo en la ronda anterior" sin
// este dato real.
export const byes = pgTable("byes", {
  id: serial("id").primaryKey(),
  editionId: integer("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "cascade" }),
  round: text("round").notNull(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  seed: integer("seed"), // cabeza de serie, si la tenía
  // Misma idea que matches.sortIndex — posición real dentro de la ronda, en el mismo
  // espacio que los partidos de esa ronda (un bye y un partido ocupan el mismo tipo de
  // hueco en la rejilla), así que los dos se pueden intercalar en orden real.
  sortIndex: integer("sort_index").notNull(),
});

// Cruce del cuadro todavía sin resolver — ni partido decidido ni bye. Los dos lados
// pueden ser un jugador real (ya emparejado, resultado pendiente: player*Id no nulo)
// o "TBD" (ni eso se sabe todavía: player*Id nulo) — pedido explícito de enseñar el
// cuadro completo desde el principio en vez de solo lo ya decidido (ver
// docs/decisiones.md, Cincinnati 2026 Trn=2092).
export const pendingSlots = pgTable("pending_slots", {
  id: serial("id").primaryKey(),
  editionId: integer("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "cascade" }),
  round: text("round").notNull(),
  player1Id: integer("player1_id").references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id),
  player1Seed: integer("player1_seed"),
  player2Seed: integer("player2_seed"),
  sortIndex: integer("sort_index").notNull(),
});

// Puntos que otorga alcanzar cada ronda, tal como los publica el propio cuadro fuente
// (`<td class="Points">`, docs/estructura.md §"Cuadro") — nunca calculados por
// nosotros. `round` usa el mismo vocabulario que `matches.round`, más el literal `W`
// para el escalón de campeón (ganar la ronda `F`), que no existe como ronda jugable en
// `matches` — ver lib/liveRanking/roundPoints.ts para la regla de qué escalón le
// corresponde a cada jugador.
export const editionRoundPoints = pgTable(
  "edition_round_points",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    round: text("round").notNull(),
    points: integer("points").notNull(),
  },
  (t) => [unique().on(t.editionId, t.round)],
);

// Resultado reciente tal como lo reporta `OT_LastResults.php` — un "ticker" aparte de
// `matches`, no una vista sobre ella: es la ÚNICA fuente que trae cuándo se reportó
// de verdad (Day+Time) y quién lo reportó, dato que no existe en el cuadro de un
// torneo (docs/estructura.md §4). `editionId` sale directo del `Trn=` del propio
// enlace — nunca hace falta casar por nombre de torneo.
export const recentResults = pgTable(
  "recent_results",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    reportedAt: timestamp("reported_at").notNull(),
    tournamentExternalId: text("tournament_external_id").notNull(),
    editionId: integer("edition_id").references(() => editions.id, { onDelete: "cascade" }),
    tournamentName: text("tournament_name").notNull(),
    competition: text("competition").notNull(),
    round: text("round").notNull(),
    winnerId: integer("winner_id")
      .notNull()
      .references(() => players.id),
    loserId: integer("loser_id")
      .notNull()
      .references(() => players.id),
    scoreRaw: text("score_raw").notNull(),
    outcome: text("outcome").notNull(),
    reporterId: integer("reporter_id").references(() => players.id),
  },
  (t) => [unique().on(t.reportedAt, t.winnerId, t.loserId, t.round)],
);

// Igual que `sets` (marcador detallado, tie-breaks incluidos) pero para un
// `recentResults`, no un `matches` — mismo motivo por el que `recentResults` es una
// tabla aparte y no una vista sobre `matches`: no siempre hay una fila de `matches`
// resuelta con la que enlazar.
export const recentResultSets = pgTable("recent_result_sets", {
  id: serial("id").primaryKey(),
  resultId: integer("result_id")
    .notNull()
    .references(() => recentResults.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  winnerGames: integer("winner_games").notNull(),
  loserGames: integer("loser_games").notNull(),
  tiebreakLoserPoints: integer("tiebreak_loser_points"),
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
    // 'official' (OT_Rankings.php?Race=0, el ranking de siempre) | 'race' (Race=1,
    // solo puntos de la temporada en curso — es la que decide plaza en las Finals).
    // Mismo origen y misma forma de fila, así que es una columna aparte y no una
    // tabla aparte; el índice único la incluye para que las dos convivan sin chocar.
    kind: text("kind").notNull().default("official"),
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
  (t) => [unique().on(t.sourceId, t.kind, t.isoYear, t.isoWeek, t.playerId)],
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
  // Clave determinista SOLO en los posts generados por IA (lib/newsGeneration) — p.ej.
  // "champion-482" o "win-streak-19-9101". Null en todo lo escrito a mano. Sirve para
  // que relanzar el generador nunca duplique el mismo hecho: `onConflictDoNothing`
  // contra este campo, no contra el título (que varía cada vez que el modelo redacta).
  autoKey: text("auto_key").unique(),
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

/**
 * Módulo aparte de "Tour Finals" (World Tour Finals / Next Gen Finals): evento
 * creado y gestionado a mano desde /admin, no importado de Mana Games. Sigue sin
 * colgar de `events`/`editions`/`matches` PARA EL FLUJO DE ADMINISTRACIÓN — seeding,
 * grupos, suplencias — porque eso de verdad es round robin + eliminatorias cruzadas,
 * sin el `Trn=` externo que asume el resto del esquema. Lo que sí cambió
 * (ver docs/decisiones.md, "Finals cuentan como torneos de verdad"): cada partido
 * decidido se ESPEJA en `matches`/`sets` bajo una `editions` sintética propia
 * (`lib/finals/mirror.ts`), para que cuente en H2H, récord de carrera, etc. — esta
 * tabla y sus hijas siguen siendo la fuente de verdad, el espejo es una proyección.
 */
export const finalsEditions = pgTable(
  "finals_editions",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // 'tour_finals' | 'next_gen_finals'
    year: integer("year").notNull(),
    displayName: text("display_name").notNull(),
    // 'setup' (asignando grupos) -> 'groups' (round robin) -> 'knockout' (SF/F, grupos ya cerrados) -> 'completed'
    status: text("status").notNull().default("setup"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    // `editions.id` del espejo de esta edición — null hasta el primer partido decidido
    // (`lib/finals/mirror.ts::ensureMirroredEdition`). Idempotencia: si ya existe, no
    // se vuelve a crear.
    mirroredEditionId: integer("mirrored_edition_id").references(() => editions.id),
  },
  (t) => [unique().on(t.kind, t.year)],
);

export const finalsParticipants = pgTable(
  "finals_participants",
  {
    id: serial("id").primaryKey(),
    finalsEditionId: integer("finals_edition_id")
      .notNull()
      .references(() => finalsEditions.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    seed: integer("seed").notNull(), // orden de clasificación (1-8): reparte grupos y desempata standings
    group: text("group"), // 'A' | 'B', null hasta que el admin asigna grupos
    status: text("status").notNull().default("active"), // 'active' | 'alternate' | 'withdrawn'
    replacesParticipantId: integer("replaces_participant_id"), // fila del jugador retirado, si esta es la suplencia que entró
  },
  (t) => [unique().on(t.finalsEditionId, t.playerId)],
);

export const finalsMatches = pgTable("finals_matches", {
  id: serial("id").primaryKey(),
  finalsEditionId: integer("finals_edition_id")
    .notNull()
    .references(() => finalsEditions.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // 'group' | 'semifinal' | 'final'
  group: text("group"), // 'A' | 'B', solo en stage='group'
  slot: text("slot"), // 'SF1' | 'SF2' | 'F', solo en fases de eliminatoria — destino de la propagación
  player1Id: integer("player1_id").references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id), // nullable: los cruces de eliminatoria empiezan vacíos
  winnerId: integer("winner_id").references(() => players.id),
  outcome: text("outcome").notNull().default("scheduled"), // 'scheduled' | 'played' | 'walkover' | 'retired' | 'disqualified'
  scoreRaw: text("score_raw"),
  playedAt: timestamp("played_at"),
  // `matches.id` del espejo de ESTE partido — null hasta que se decide. Presente =
  // hay que UPDATE el espejo al re-sincronizar, no INSERT de nuevo
  // (`lib/finals/mirror.ts::syncMirroredMatch`).
  mirroredMatchId: integer("mirrored_match_id").references(() => matches.id),
});

export const finalsSets = pgTable("finals_sets", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => finalsMatches.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  winnerGames: integer("winner_games").notNull(),
  loserGames: integer("loser_games").notNull(),
  tiebreakLoserPoints: integer("tiebreak_loser_points"),
});

/**
 * VOD del canal de YouTube oficial (@TennisElbowOnlineTour) enlazado a un partido de
 * `matches`. Una fila por vídeo ya procesado — `youtube_video_id` es único a
 * propósito, así que volver a escanear el canal nunca reprocesa un vídeo ya visto.
 *
 * `match_id` puede ser null: un vídeo en 'pending' puede no tener ni siquiera una
 * propuesta razonable (el emparejador no encontró un partido plausible) y aun así
 * queda registrado, para no volver a intentarlo en cada sincronización.
 */
export const matchVideos = pgTable(
  "match_videos",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").references(() => matches.id, { onDelete: "set null" }),
    youtubeVideoId: text("youtube_video_id").notNull(),
    title: text("title").notNull(),
    publishedAt: timestamp("published_at"),
    // 'auto' (emparejado sin ambigüedad) | 'pending' (esperando revisión manual) |
    // 'confirmed' (admin lo confirmó) | 'rejected' (admin descartó la propuesta)
    status: text("status").notNull().default("pending"),
    matchConfidence: text("match_confidence"), // explicación en texto libre de por qué se propuso (o no) este partido
    // en 'pending': exactamente los partidos ya jugados entre los dos rivales resueltos
    // del título, para que la revisión en /admin/videos ofrezca solo esas opciones —
    // nunca un buscador abierto a todo el histórico.
    candidateMatchIds: jsonb("candidate_match_ids").$type<number[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.youtubeVideoId)],
);

export const importRuns = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id")
    .notNull()
    .references(() => sources.id),
  kind: text("kind").notNull(), // 'tournament' | 'ranking' | 'scores'
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // 'success' | 'partial' | 'failed'
  filesProcessed: integer("files_processed").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  errors: jsonb("errors"),
});
