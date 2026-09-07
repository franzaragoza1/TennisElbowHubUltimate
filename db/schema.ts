import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  boolean,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // 'mana' | 'te4tour' | 'te4matchlog'
  name: text("name").notNull(),
});

/**
 * Identidad de inicio de sesión (Discord vía Auth.js/NextAuth) — DISTINTA de
 * `players`, que es la identidad canónica del jugador de tenis. Un `authUsers` puede
 * no tener ningún `players` vinculado todavía (recién entrado, sin reclamar ni crear
 * jugador); un `players` puede no tener ningún `authUsers` vinculado nunca (todo el
 * histórico importado de Mana Games). El enlace vive en `players.linkedUserId`,
 * nunca al revés. Forma de tabla fija por `@auth/drizzle-adapter` — de ahí el PK de
 * texto en vez del serial habitual del resto del esquema.
 */
export const authUsers = pgTable("auth_users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"), // avatar de Discord tal como lo da el proveedor OAuth
  // Columna propia añadida encima de las 5 que exige `@auth/drizzle-adapter` — el
  // adaptador solo lee/escribe esos 5 campos (ver auth.ts), así que uno extra con
  // default no le afecta. Pedido explícito: "I'm not on PC, stop reminding me" en el
  // popup de recordatorio de MatchLog (lib/matchLog/uploadReminder.ts) — permanente
  // por cuenta, no un simple "cerrar" de sesión de navegador, porque el motivo real
  // (jugar solo en móvil/consola, sin acceso al fichero MatchLog) no cambia entre
  // dispositivos.
  matchLogReminderOptedOut: boolean("match_log_reminder_opted_out").notNull().default(false),
});

// Los 6 campos de token de abajo usan clave JS en snake_case (no el camelCase
// habitual del resto del esquema) a propósito: es lo que exige el tipo
// `DefaultPostgresAccountsTable` de `@auth/drizzle-adapter` (node_modules/@auth/
// drizzle-adapter/lib/pg.d.ts) para aceptar esta tabla sin `as unknown as`.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'oauth' (único valor usado, solo Discord)
    provider: text("provider").notNull(), // 'discord'
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [unique().on(t.provider, t.providerAccountId)],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires").notNull(),
  },
  (t) => [unique().on(t.identifier, t.token)],
);

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
  linkedUserId: text("linked_user_id")
    .unique()
    .references(() => authUsers.id, { onDelete: "set null" }),
  // Año de alta declarado al crear un perfil nuevo desde la web — flujo RETIRADO
  // (`app/account/actions.ts::createLinkedPlayer` existió y se quitó: no hay forma
  // legítima de "crear" un jugador que el foro de Mana Games no reconozca, todo el que
  // juega en el tour ya está importado de ahí). Columna conservada por el histórico ya
  // guardado con ella; null para todo lo demás — todo el histórico importado, todo
  // jugador reclamado (nunca creado), y cualquier cuenta nueva de aquí en adelante. Es
  // lo que filtra el Next Gen Ranking nativo (lib/nativeRanking/nextGenRanking.ts), que
  // por tanto ya no puede ganar filas nuevas por esta vía. Distinto de `firstSeenYear`
  // (lib/h2hStats.ts::getCareerStats, derivado del ranking de Mana) — no confundir los
  // dos conceptos, no comparten código.
  startYear: integer("start_year"),
  // Avatar mostrado en todo el sitio — Discord del usuario vinculado (copiado en cada
  // inicio de sesión, nunca a mano, nunca por el importador) O, si `avatarIsCustom` es
  // true, una imagen subida por el propio jugador (data URI, ver
  // components/account/AvatarUpload.tsx) guardada tal cual en este mismo campo — no
  // hace falta una columna ni una tabla aparte, cualquier string aquí ya es válido
  // como `src` de `<img>`. Instantánea deliberada en vez de JOIN en vivo contra
  // `authUsers`: evita añadir ese JOIN a cada consulta existente que ya selecciona
  // campos de `players` para pintar un `PlayerAvatar` (rankings, cuadros, H2H,
  // sidebar, ~9 sitios) — el riesgo de que el avatar de Discord quede desactualizado
  // hasta el siguiente login se acepta a cambio (subir una foto propia no tiene ese
  // problema, nunca depende de un login para refrescarse).
  avatarUrl: text("avatar_url"),
  // true = `avatarUrl` es una foto subida a mano — el evento `signIn` de auth.ts NUNCA
  // la pisa con el avatar de Discord mientras esto sea true, o cada login volvería a
  // borrar la foto que el jugador eligió. Se vuelve a poner en false al pulsar "usar
  // el avatar de Discord" (app/account/actions.ts::removeCustomAvatar).
  avatarIsCustom: boolean("avatar_is_custom").notNull().default(false),

  // --- Campos de perfil editables por el propio jugador (app/account/actions.ts::
  // updatePlayerProfile) — todos opcionales, se omiten en la ficha pública cuando
  // están vacíos, no hay toggle de visibilidad por campo: el propio jugador ya
  // controla qué se enseña simplemente rellenando o no cada uno. `realName` en
  // particular es explícitamente opcional, nunca obligatorio.
  bio: text("bio"),
  realName: text("real_name"),
  // La edad se deriva de esto en el momento de pintar la ficha (lib/age.ts) — nunca se
  // guarda un número de edad aparte, que quedaría desactualizado al día siguiente.
  birthDate: date("birth_date"),
  // 'right-handed' | 'left-handed' | null — texto plano, igual que `outcome`/`round`
  // en otras tablas de este fichero, no hace falta un enum de Postgres para dos
  // valores.
  playstyle: text("playstyle"),
  clothingBrand: text("clothing_brand"),
  racketBrand: text("racket_brand"),
  // Solo el usuario (@handle), sin URL — el enlace se construye en la UI.
  instagramHandle: text("instagram_handle"),
  youtubeUrl: text("youtube_url"),
});

/**
 * Ficha de "Build" del juego (Character Sheet de TE4: Rally/Service/Volley/Special/
 * Physique, Puntos, Estilo, Rasgo de aceleración) — pedido explícito del propietario,
 * rellenada a mano por el jugador en /account (no hay forma de importarla, es un dato
 * local de partida-única que el juego nunca expone en el foro). Todas las columnas de
 * estadística son opcionales: un jugador puede guardar solo la imagen, o solo unas
 * pocas casillas. `isPublic` decide si aparece en la ficha pública — apagado por
 * defecto, el jugador decide cuándo enseñarla (pedido explícito, "the player can
 * choose to keep it public or private").
 */
export const playerBuilds = pgTable(
  "player_builds",
  {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  // Hasta 3 por jugador (MAX_BUILDS_PER_PLAYER, lib/buildStats.ts, contado en
  // app/account/actions.ts::createPlayerBuild) — pedido explícito: antes era 1:1 con
  // el jugador (unique en playerId), ahora el jugador nombra cada una para
  // distinguirlas ("Clay build", "Attacker"...).
  name: text("name").notNull(),
  // Exactamente una `true` por jugador cuando tiene builds de sobra — es la que
  // enseña la ficha pública (components/players/PlayerBuildCard.tsx), independiente
  // de `isPublic` de abajo (una build puede ser la "in use" y seguir siendo privada).
  // El índice único parcial de más abajo lo hace imposible de violar incluso con un
  // fallo de la propia app: como mucho una fila por jugador con `in_use = true`.
  inUse: boolean("in_use").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  // Qué stats en concreto se enseñan cuando `isPublic` es true — lista de claves
  // (lib/buildStats.ts::StatKey) que el jugador ha marcado explícitamente visibles.
  // Vacía por defecto, igual criterio "apagado hasta que el jugador lo active" que
  // `isPublic` mismo — pedido explícito, "add a trigger for every stat to
  // specifically keep it private or public".
  visibleStats: jsonb("visible_stats").$type<string[]>().notNull().default([]),
  archetype: text("archetype"), // "Defender", "Attacker"... texto libre, TE4 no tiene una lista fija conocida
  // Uno de los 9 valores reales del juego (lib/buildStats.ts::ACCELERATION_TRAITS) —
  // validado como enum en la Zod schema (app/account/actions.ts), esta columna sigue
  // siendo texto plano sin más.
  accelerationTrait: text("acceleration_trait"),
  // Rally
  forehandPower: integer("forehand_power"),
  forehandConsistency: integer("forehand_consistency"),
  forehandPrecision: integer("forehand_precision"),
  backhandPower: integer("backhand_power"),
  backhandConsistency: integer("backhand_consistency"),
  backhandPrecision: integer("backhand_precision"),
  // Service
  servicePower: integer("service_power"),
  serviceConsistency: integer("service_consistency"),
  servicePrecision: integer("service_precision"),
  // Volley
  forehandVolley: integer("forehand_volley"),
  backhandVolley: integer("backhand_volley"),
  smash: integer("smash"),
  netPresence: integer("net_presence"),
  // Special
  focus: integer("focus"),
  counter: integer("counter"),
  lob: integer("lob"),
  dropShot: integer("drop_shot"),
  topSpin: integer("top_spin"),
  // Physique
  speed: integer("speed"),
  stamina: integer("stamina"),
  muscleTone: integer("muscle_tone"),
  // Short Term Form se retiró del todo (pedido explícito, "not useful to keep on the
  // website") — no queda ni como stat visible ni como columna, a diferencia de Top
  // Spin (lib/buildStats.ts::FREE_STAT_KEYS), que sigue mostrándose aunque tampoco
  // cueste puntos.
  //
  // `points` ya NO es un valor que el jugador escriba — se deriva de las demás
  // estadísticas (lib/buildPoints.ts::computeBuildPoints, fórmula real del juego
  // verificada contra dos screenshots de referencia) y el servidor lo recalcula en
  // cada guardado, nunca confía en lo que mande el cliente. No es un porcentaje (772
  // en la captura de referencia) — sin tope de 100.
  points: integer("points"),
  // Recorte del propio personaje in-game, del mismo screenshot del Character Sheet —
  // mismo patrón que `players.avatarUrl` (data URI tal cual, sin tabla ni storage
  // aparte), nunca pasa por regeneración de IA (pedido explícito, se deja para más
  // adelante si acaso).
  characterImageUrl: text("character_image_url"),
  // Código largo que el propio juego genera para exportar/compartir un personaje
  // (Character Sheet -> copiar) — texto opaco, no se valida su forma (no es cosa
  // nuestra saber qué hace válido un código del juego), solo se guarda y se enseña tal
  // cual para que otro jugador lo pegue en el suyo. A diferencia de
  // `originalScreenshotUrl`, este SÍ es público cuando `isPublic` lo es — es
  // literalmente para compartir, pedido explícito.
  characterCode: text("character_code"),
  // El screenshot completo tal cual se subió — SIEMPRE privado, nunca sujeto a
  // `isPublic` ni mostrado en la ficha pública (components/players/PlayerBuildCard.tsx
  // no lo lee nunca): se guarda solo para que el propio jugador pueda volver a
  // recortarlo o repetir la extracción de estadísticas más adelante.
  originalScreenshotUrl: text("original_screenshot_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // Refuerzo a nivel de base de datos del invariante "como mucho una build en uso por
  // jugador" — un índice único PARCIAL (solo sobre las filas con in_use = true) deja
  // vincular libremente varias filas con in_use = false para el mismo jugador, que es
  // justo lo que hace falta aquí. `setBuildInUse` (app/account/actions.ts) ya lo hace
  // bien con un único UPDATE atómico, pero esto evita que cualquier futuro bug de la
  // app pueda dejar dos builds "en uso" a la vez sin que Postgres se queje.
  (t) => [uniqueIndex("player_builds_one_in_use").on(t.playerId).where(sql`${t.inUse} = true`)],
);

/**
 * Solicitud de un usuario (Discord) para vincularse a un `players` YA EXISTENTE (un
 * jugador scrapeado de Mana, sin dueño todavía) — a diferencia de crear un perfil
 * nuevo (players.linkedUserId se rellena directo, sin pasar por aquí), esto SIEMPRE
 * pasa por aprobación manual de un admin (app/admin/players/claims/actions.ts), nunca
 * se auto-aprueba. Una sola solicitud 'pending' por usuario y por jugador a la vez se
 * exige en código (app/account/actions.ts::requestPlayerClaim), no hay restricción a
 * nivel de esquema.
 */
export const playerClaimRequests = pgTable("player_claim_requests", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
  // Puesto por el bot (lib/discordBot/tasks/notifyClaimApproved.ts), nunca por
  // app/admin/players/claims/actions.ts — la aprobación es un botón de admin en la
  // web, pero el bot vive en un proceso aparte (ver scripts/discordBot.ts) y se entera
  // sondeando esta tabla, mismo patrón que `discordMatchupThreads.overdueNotifiedAt`.
  notifiedAt: timestamp("notified_at"),
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

/**
 * Variantes de nombre conocidas para un jugador, a mano del admin — distinto de
 * `playerAliases` (esa es identidad real de una fuente externa, `sourceId` +
 * `externalId`; esto no tiene ninguno de los dos, es solo texto). Existe para
 * `lib/matchLog/linkToTourMatch.ts`: un `MatchLog` local puede traer un nombre que ya
 * cambió (Mana sobrescribe el nombre viejo en cuanto se resincroniza, no queda
 * histórico en ningún sitio) o un mote que nunca coincidirá por exacto con
 * `players.displayName` — el admin lo añade una vez, aquí, y desde entonces
 * cualquier fichero (ya subido o futuro) que traiga ese nombre resuelve solo.
 */
export const playerKnownNames = pgTable(
  "player_known_names",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [unique().on(t.playerId, t.name)],
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

/**
 * Cola de inscripción de un torneo NATIVO (sourceId apuntando a `te4tour`, ver
 * lib/nativeTournaments/source.ts) antes de que exista cuadro — un jugador apuntado
 * aquí puede no tener todavía ningún cruce real. Distinta de `pendingSlots` (cruces
 * YA emparejados de un cuadro publicado, sean torneos Mana o nativos): esto es una
 * lista plana, sin bracket, que el admin usa para decidir el draw real y generar el
 * cuadro (lib/nativeTournaments/seeding.ts) cuando cierra la inscripción. No exige
 * que el jugador tenga cuenta de Discord vinculada — un admin puede apuntar a
 * cualquier `players` existente, incluyendo histórico de Mana sin reclamar todavía.
 */
export const nativeTournamentRegistrations = pgTable(
  "native_tournament_registrations",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    seed: integer("seed"), // asignado por el admin antes de generar el cuadro
    status: text("status").notNull().default("registered"), // 'registered' | 'withdrawn'
    registeredAt: timestamp("registered_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.editionId, t.playerId)],
);

export const matches = pgTable(
  "matches",
  {
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
  },
  // Postgres no indexa solo por tener una FK — sin esto, cada entrada `[Online]` de un
  // MatchLog obligaba a un sequential scan de TODA la tabla en
  // lib/matchLog/linkToTourMatch.ts::findTourMatch (winnerId + par de jugadores), que
  // es justo la consulta que se repite una o dos veces POR CADA fila del fichero
  // subido — el cuello de botella real de la subida, no el parseo del HTML.
  (t) => [index("matches_winner_players_idx").on(t.winnerId, t.player1Id, t.player2Id)],
);

export const sets = pgTable(
  "sets",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    winnerGames: integer("winner_games").notNull(),
    loserGames: integer("loser_games").notNull(),
    tiebreakLoserPoints: integer("tiebreak_loser_points"), // "7(5)" -> 5
  },
  // Mismo motivo que el índice de `matches` de arriba: findTourMatch trae los sets de
  // todos los candidatos con `WHERE matchId IN (...) ORDER BY setNumber`, también por
  // cada entrada del fichero.
  (t) => [index("sets_match_id_idx").on(t.matchId, t.setNumber)],
);

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

// Plazo para jugar cada ronda, tal como lo publica el propio cuadro fuente — una fila
// EXTRA de `<td class="Points">` justo debajo de la de puntos, solo presente mientras
// el torneo sigue en juego (confirmado contra datos reales el 2026-09-05: un torneo ya
// completado deja de traer esta fila por completo — nunca hace falta distinguir
// "pasado" de "sin plazo", basta con que la fila exista o no). Cada celda da
// "Weekday DD" (día de la semana + día del mes, sin mes ni año); `lib/mana/*` lo
// resuelve contra `editions.weekStartDate` antes de guardar aquí, así que
// `deadlineAt` ya es un instante UTC completo (fin del día resuelto, 23:59:59 UTC —
// el foro no da hora, es una convención nuestra documentada en el parser).
export const editionRoundDeadlines = pgTable(
  "edition_round_deadlines",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    round: text("round").notNull(),
    deadlineAt: timestamp("deadline_at").notNull(),
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

/**
 * Un `MatchLog - *.html` subido desde `/admin/match-log` — se guarda el HTML crudo,
 * no solo un resumen, para que "Refresh" (`lib/matchLog/importMatchLog.ts::refreshMatchLogFile`)
 * pueda volver a procesarlo sin que el admin tenga que volver a localizarlo y
 * subirlo desde su PC (útil sobre todo justo después de añadir un `player_known_names`
 * nuevo: partidos que fallaron en la primera subida pueden resolver a la segunda).
 * `totalOnlineEntries`/`linked`/`skipped`/`errors` reflejan siempre el ÚLTIMO
 * procesado, no un histórico acumulado.
 */
export const matchLogFiles = pgTable("match_log_files", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  html: text("html").notNull(),
  // Null = subido desde /admin/match-log (el sistema de admin no tiene identidad de
  // authUsers, ver lib/adminSession.ts) — no null cuando lo sube un jugador desde
  // /account, para poder recordarle "hace X días que no subes tu log" (CLAUDE.md
  // pedido explícito: la web se lo pregunta cada cierto tiempo, ver
  // lib/matchLog/uploadReminder.ts).
  uploadedByUserId: text("uploaded_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  lastProcessedAt: timestamp("last_processed_at").notNull().defaultNow(),
  totalOnlineEntries: integer("total_online_entries").notNull().default(0),
  linked: integer("linked").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  errors: jsonb("errors"), // string[] — motivos de descarte del último procesado
  // Nombres de jugador del último procesado que no resolvieron contra nadie (ni
  // exacto, ni player_known_names, ni la forma abreviada) — string[], distinto de
  // `errors` (texto libre para el admin) porque esto alimenta a
  // `lib/matchLog/suggestNameMatches.ts`, que necesita el nombre suelto, no la frase.
  unresolvedNames: jsonb("unresolved_names"),
});

/**
 * Una sugerencia de IA (Groq, ver `lib/matchLog/suggestNameMatches.ts`) de que un
 * nombre sin resolver de un MatchLog podría ser tal jugador del tour — nunca se
 * aplica sola: el admin la aprueba o la descarta en `/admin/match-log`. Aprobarla
 * inserta una fila en `player_known_names` (después de eso, exactamente lo mismo que
 * si el admin la hubiera escrito a mano) y relanza el `refresh` de cualquier fichero
 * que trajera ese nombre. `unique(unresolvedName)`: una vez sugerido o descartado un
 * nombre, no se le vuelve a preguntar a la IA por él.
 */
export const playerNameSuggestions = pgTable(
  "player_name_suggestions",
  {
    id: serial("id").primaryKey(),
    unresolvedName: text("unresolved_name").notNull(),
    suggestedPlayerId: integer("suggested_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    reason: text("reason"), // explicación corta del modelo, para que el admin no apruebe a ciegas
    status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'dismissed'
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.unresolvedName)],
);

/**
 * Estadísticas reales de un partido, por jugador — CLAUDE.md ya preveía esta tabla
 * pero se quedó vacía desde el principio: Mana Games no publica nada de esto en
 * OT_ViewTournament.php (docs/estructura.md), solo el marcador. Los datos sí existen,
 * en el `MatchLog - *.html` local de cada jugador (TE4 los guarda ahí siempre que se
 * juega en modo [Online]) — `lib/matchLog/*` importa ese fichero, encuentra la fila de
 * `matches` real a la que corresponde cada entrada (por pareja de jugadores + marcador
 * set a set exacto) y rellena esto. Nunca se inventa nada: una entrada que no enlaza
 * con un `matches` ya existente simplemente no entra aquí.
 *
 * `unique(matchId, playerId)`: subir el mismo fichero dos veces, o que dos jugadores
 * distintos suban cada uno su propio log del mismo partido, no debe duplicar fila —
 * `onConflictDoUpdate` sobre esta clave lo hace idempotente. `matchLogFileId` en
 * cascada: borrar el fichero subido ("Eliminate" en `/admin/match-log`) borra
 * también las filas de estadísticas que escribió — pedido explícito, no solo
 * limpieza del historial. Si el mismo (matchId, playerId) lo escriben DOS ficheros
 * distintos (cada jugador sube su propio log del mismo partido), el segundo upsert
 * pisa la referencia al primer fichero; es una simplificación aceptada, no un caso
 * que se vaya a dar a menudo.
 */
export const matchStats = pgTable(
  "match_stats",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    matchLogFileId: integer("match_log_file_id").references(() => matchLogFiles.id, { onDelete: "cascade" }),
    aces: integer("aces"),
    doubleFaults: integer("double_faults"),
    firstServeAttempted: integer("first_serve_attempted"),
    firstServeIn: integer("first_serve_in"),
    firstServePointsPlayed: integer("first_serve_points_played"),
    firstServePointsWon: integer("first_serve_points_won"),
    secondServePointsPlayed: integer("second_serve_points_played"),
    secondServePointsWon: integer("second_serve_points_won"),
    // Como restador, no como sacador: puntos de break que TUVO como oportunidad
    // devolviendo, y cuántos convirtió. Nombres ya existían en la versión anterior de
    // esta tabla, se mantienen.
    breakPointsFaced: integer("break_points_faced"),
    breakPointsWon: integer("break_points_won"),
    returnPointsPlayed: integer("return_points_played"),
    returnPointsWon: integer("return_points_won"),
    netPointsPlayed: integer("net_points_played"),
    netPointsWon: integer("net_points_won"),
    winners: integer("winners"),
    forcedErrors: integer("forced_errors"),
    unforcedErrors: integer("unforced_errors"),
    totalPointsWon: integer("total_points_won"),
    // TE4 cambia de unidad a media partida en los ficheros reales (Km/h -> Mph) — el
    // parser normaliza siempre a km/h antes de guardar, nunca se mezclan unidades aquí.
    fastestServeKmh: integer("fastest_serve_kmh"),
    avgFirstServeSpeedKmh: integer("avg_first_serve_speed_kmh"),
    avgSecondServeSpeedKmh: integer("avg_second_serve_speed_kmh"),
  },
  (t) => [unique().on(t.matchId, t.playerId)],
);

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
  // Opcional — pedido explícito. Nunca se rellena solo: una noticia generada por IA
  // (lib/newsGeneration) nace en borrador con esto en null igual que todo lo demás
  // pendiente de revisar, así que el admin siempre pasa por el formulario (donde ve
  // el campo vacío) antes de publicar de verdad.
  author: text("author"),
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
 * Igual que `h2hNarratives` de arriba pero para UN jugador en vez de una pareja — el
 * párrafo "cómo le va" de su ficha pública más 2-3 consejos cortos
 * (lib/playerOverview.ts). Mismo mecanismo de caché por `fingerprint`: cambia en
 * cuanto juega un partido nuevo, sube/baja de ranking, o completa una entrevista
 * nueva del bot, y solo entonces.
 */
export const playerOverviews = pgTable("player_overviews", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .unique()
    .references(() => players.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  overview: text("overview").notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
  downsides: jsonb("downsides").$type<string[]>().notNull().default([]),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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

/**
 * Bot de Discord — organización de partidos pendientes. Una fila por CADA
 * emparejamiento anunciado alguna vez, identificado por su clave NATURAL (editionId,
 * round, player1Id, player2Id) — nunca por `pending_slots.id`, que se borra y se
 * vuelve a crear en cada recarga del torneo (`lib/mana/loadTournament.ts`) aunque sea
 * el MISMO emparejamiento real todavía sin jugar. Indexar por `pending_slots.id`
 * volvería a anunciar y crear hilo del mismo cruce cada ~10 minutos para siempre.
 */
export const discordMatchupThreads = pgTable(
  "discord_matchup_threads",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    round: text("round").notNull(),
    player1Id: integer("player1_id")
      .notNull()
      .references(() => players.id),
    player2Id: integer("player2_id")
      .notNull()
      .references(() => players.id),
    threadId: text("thread_id").notNull(), // snowflake de Discord
    channelId: text("channel_id").notNull(),
    // null = todavía sin confirmar. Un jugador sin Discord vinculado nunca puede
    // confirmar (no hay botón para él) — "todo confirmado" se calcula en código como
    // "todo LADO VINCULADO tiene esto no nulo", nunca contando los dos lados a ciegas.
    player1ConfirmedAt: timestamp("player1_confirmed_at"),
    player2ConfirmedAt: timestamp("player2_confirmed_at"),
    // Días extra que un moderador ha concedido con /extend, ENCIMA del plazo real de
    // `edition_round_deadlines` (que se sigue leyendo en vivo al comprobar recordatorios,
    // nunca se copia aquí — si Mana publica un plazo nuevo porque un moderador lo
    // extendió EN SU PROPIO SITIO, el siguiente scrape ya lo recoge solo).
    extensionDays: integer("extension_days").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at"),
    // Se pone UNA vez al pasar el plazo (con la extensión ya sumada) y nunca se vuelve
    // a tocar — el aviso de "esto ya venció" se manda una sola vez, no en cada pasada.
    overdueNotifiedAt: timestamp("overdue_notified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.editionId, t.round, t.player1Id, t.player2Id)],
);

/**
 * Bot de Discord — resultado ya anunciado. Misma razón para la clave natural que
 * `discordMatchupThreads`: `matches.id` TAMBIÉN se borra y se vuelve a crear en cada
 * recarga del torneo, para TODOS sus partidos (no solo los nuevos) — indexar por
 * `matches.id` republicaría cada resultado ya jugado en cada scrape.
 */
export const discordMatchResultPosts = pgTable(
  "discord_match_result_posts",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    round: text("round").notNull(),
    player1Id: integer("player1_id")
      .notNull()
      .references(() => players.id),
    player2Id: integer("player2_id")
      .notNull()
      .references(() => players.id),
    messageId: text("message_id").notNull(),
    channelId: text("channel_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.editionId, t.round, t.player1Id, t.player2Id)],
);

/**
 * Bot de Discord — mini-entrevista tras un resultado, hasta 3 preguntas generadas por
 * IA (`lib/newsGeneration/interviewQuestions.ts`), solo para jugadores con Discord
 * vinculado. Al completarse alimenta un borrador de noticia
 * (`lib/newsGeneration/facts.ts`, kind `post_match_interview`) — nunca se publica solo,
 * mismo criterio que el resto de noticias generadas (`news.status = 'draft'`).
 */
export const discordInterviewThreads = pgTable(
  "discord_interview_threads",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    round: text("round").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    opponentId: integer("opponent_id")
      .notNull()
      .references(() => players.id),
    scoreRaw: text("score_raw"),
    threadId: text("thread_id").notNull(),
    status: text("status").notNull().default("in_progress"), // 'in_progress' | 'completed'
    qa: jsonb("qa").$type<{ question: string; answer: string }[]>().notNull().default([]),
    // Pregunta que el bot acaba de hacer y todavía no tiene respuesta emparejada en
    // `qa` — null mientras no hay ninguna pendiente (justo tras completar la
    // entrevista, o antes de la primera pregunta). Sin esto no habría forma de saber
    // qué pregunta corresponde a la respuesta que llega por `messageCreate`.
    pendingQuestion: text("pending_question"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.editionId, t.round, t.playerId)],
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

/**
 * Vercel no puede lanzar el Chromium real que necesita `lib/mana/fetchLive.ts` (ver su
 * comentario) — los tres botones de admin que scrapean en vivo (Add/Refresh tournament,
 * Refresh rankings, Refresh scores) solo funcionan corriendo en local o en el servidor
 * casero que ejecuta `scripts/autoScrape.ts`. En producción esos botones INSERTAN una
 * fila aquí en vez de intentar Playwright directamente; `autoScrape.ts` la recoge en su
 * siguiente pasada, la ejecuta de verdad y actualiza el estado — mismo criterio que
 * `player_claim_requests` (pendiente -> resuelto por otro proceso), no el de
 * `import_runs` (que solo registra una carga ya terminada).
 */
export const scrapeRequests = pgTable("scrape_requests", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // 'tournament' | 'ranking' | 'scores' — mismo vocabulario que import_runs.kind
  input: text("input"), // Trn= externalId ya parseado, para 'tournament' — null en 'ranking'/'scores'
  status: text("status").notNull().default("queued"), // 'queued' | 'running' | 'done' | 'failed'
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  error: text("error"),
  // Edición resultante si kind='tournament' y salió bien — para que el panel de admin
  // pueda enlazar directamente al torneo ya cargado.
  resultEditionId: integer("result_edition_id").references(() => editions.id),
});

/**
 * Ventana deslizante genérica de "esto pasó" para limitar abusos — ver
 * lib/rateLimit.ts, que es el único código que la lee/escribe. Una fila por intento
 * contado (login de admin fallido, subida de MatchLog, solicitud de claim...), nunca un
 * contador acumulado: contar filas recientes de una `bucketKey` es lo que permite una
 * ventana de tiempo de verdad (deslizante) sin lógica de reseteo aparte. Se autolimpia
 * sola (ver `isRateLimited`) — nunca crece sin límite ni necesita un cron aparte.
 */
export const rateLimitHits = pgTable("rate_limit_hits", {
  id: serial("id").primaryKey(),
  bucketKey: text("bucket_key").notNull(), // p.ej. "admin_login", "claim:<userId>", "matchlog:<userId>"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
