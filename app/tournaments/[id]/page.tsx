import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  byes,
  discordInterviewThreads,
  editionRoundDeadlines,
  editions,
  events,
  finalsEditions,
  matches,
  matchStats,
  matchVideos,
  pendingSlots,
  players,
  sets,
} from "@/db/schema";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { BracketColumns, type TournamentBracketMatch } from "@/components/tournament/BracketColumns";
import { BYE_PLAYER_ID, TBD_PLAYER_ID, MatchCard, type MatchCardData, type MatchCardPlayer } from "@/components/tournament/MatchCard";
import { RoundDeadlines } from "@/components/tournament/RoundDeadlines";
import { NextOpponentPanel } from "@/components/tournament/NextOpponentPanel";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { deriveTournamentStatus } from "@/lib/tournamentStatus";
import { getTournamentHeaderUrl } from "@/lib/tournamentHeaders";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { getFinalsFormat } from "@/lib/finals/format";
import { getGroupMatches, getGroupStandingsRows, getKnockoutMatches } from "@/lib/finals/queries";
import { GroupStandingsTable } from "@/components/finals/GroupStandingsTable";
import { FinalsKnockoutBracket, type KnockoutSlotMatch } from "@/components/finals/FinalsKnockoutBracket";

// 10 min, no 1h: un torneo en juego (ver AutoRefresh más abajo) necesita que una
// visita fresca no pueda traer datos de hace una hora entera.
export const revalidate = 600;

export async function generateStaticParams() {
  const rows = await db.select({ id: editions.id }).from(editions);
  return rows.map((r) => ({ id: String(r.id) }));
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const editionId = Number(id);
  if (!Number.isInteger(editionId)) notFound();

  const [edition] = await db
    .select({
      id: editions.id,
      year: editions.year,
      isoWeek: editions.isoWeek,
      surface: editions.surface,
      category: editions.category,
      drawSize: editions.drawSize,
      officialTopicUrl: editions.officialTopicUrl,
      eventName: events.displayName,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(eq(editions.id, editionId));
  if (!edition) notFound();

  // Una edición espejo de Finals (lib/finals/mirror.ts) no tiene un cuadro de
  // eliminación de verdad que dibujar con `BracketColumns` — su fase de grupos usa
  // rondas "RR-A"/"RR-B" que lib/bracket.ts no conoce (solo sabe de escaleras de
  // eliminación directa), así que el cuadro salía a medias, mostrando solo semis y
  // final (bug real reportado). Hasta 2026-09-09 esto redirigía a una página propia
  // (/finals/[id], con grupos + eliminatoria completos) que se retiró sin arreglar
  // los enlaces que apuntaban aquí — 404 real reportado. Recuperado como una rama
  // aparte de ESTA MISMA página (renderFinalsPage más abajo) en vez de resucitar
  // aquella ruta: reutiliza la cabecera/masthead normal y evita mantener dos páginas
  // de torneo distintas.
  const [mirroredFinals] = await db
    .select({ id: finalsEditions.id, kind: finalsEditions.kind })
    .from(finalsEditions)
    .where(eq(finalsEditions.mirroredEditionId, editionId));
  if (mirroredFinals) return renderFinalsPage(edition, mirroredFinals.id, mirroredFinals.kind);

  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  const matchRows = await db
    .select({
      id: matches.id,
      round: matches.round,
      outcome: matches.outcome,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Seed: matches.player1Seed,
      player2Seed: matches.player2Seed,
      player1Name: p1.displayName,
      player1Country: sql<string | null>`coalesce(${p1.countryOverride}, ${p1.country})`,
      player2Name: p2.displayName,
      player2Country: sql<string | null>`coalesce(${p2.countryOverride}, ${p2.country})`,
      sortIndex: matches.sortIndex,
    })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(eq(matches.editionId, editionId))
    // El id de partido sigue el orden de inserción del parser — antes era la única
    // pista de posición disponible; ahora `sortIndex` (posición real en la rejilla
    // fuente, ver parsers/schemas.ts) manda, y esto queda solo como desempate estable
    // y como red de seguridad para filas de antes de que existiera esa columna.
    .orderBy(asc(matches.id));

  const byeRows = await db
    .select({
      round: byes.round,
      playerId: byes.playerId,
      seed: byes.seed,
      sortIndex: byes.sortIndex,
      displayName: players.displayName,
      country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
    })
    .from(byes)
    .innerJoin(players, eq(players.id, byes.playerId))
    .where(eq(byes.editionId, editionId));

  const pp1 = alias(players, "pp1");
  const pp2 = alias(players, "pp2");
  const pendingRows = await db
    .select({
      round: pendingSlots.round,
      sortIndex: pendingSlots.sortIndex,
      player1Id: pendingSlots.player1Id,
      player2Id: pendingSlots.player2Id,
      player1Seed: pendingSlots.player1Seed,
      player2Seed: pendingSlots.player2Seed,
      player1Name: pp1.displayName,
      player1Country: sql<string | null>`coalesce(${pp1.countryOverride}, ${pp1.country})`,
      player2Name: pp2.displayName,
      player2Country: sql<string | null>`coalesce(${pp2.countryOverride}, ${pp2.country})`,
    })
    .from(pendingSlots)
    .leftJoin(pp1, eq(pp1.id, pendingSlots.player1Id))
    .leftJoin(pp2, eq(pp2.id, pendingSlots.player2Id))
    .where(eq(pendingSlots.editionId, editionId));

  const matchIds = matchRows.map((m) => m.id);
  const setRows =
    matchIds.length > 0
      ? await db.select().from(sets).where(inArray(sets.matchId, matchIds))
      : [];
  const setsByMatch = new Map<number, MatchCardData["sets"]>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push({
      setNumber: s.setNumber,
      winnerGames: s.winnerGames,
      loserGames: s.loserGames,
      tiebreakLoserPoints: s.tiebreakLoserPoints,
    });
  }
  for (const list of setsByMatch.values()) list.sort((a, b) => a.setNumber - b.setNumber);

  const videoRows =
    matchIds.length > 0
      ? await db
          .select({ matchId: matchVideos.matchId, youtubeVideoId: matchVideos.youtubeVideoId })
          .from(matchVideos)
          .where(and(inArray(matchVideos.matchId, matchIds), inArray(matchVideos.status, ["auto", "confirmed"])))
      : [];
  const videoByMatch = new Map(videoRows.filter((v) => v.matchId !== null).map((v) => [v.matchId!, v.youtubeVideoId]));

  // Partidos con fila(s) reales en `match_stats` (ver lib/matchLog/*) — solo esos
  // enseñan el botón "Estadísticas" del pie de la tarjeta.
  const statsRows =
    matchIds.length > 0
      ? await db.selectDistinct({ matchId: matchStats.matchId }).from(matchStats).where(inArray(matchStats.matchId, matchIds))
      : [];
  const matchIdsWithStats = new Set(statsRows.map((r) => r.matchId));

  // Un hilo de entrevista no guarda `matchId` (nace de un botón "Interview" con
  // `editionId:round:playerId:opponentId` en el `customId`, ver
  // lib/discordBot/interactions/interviewButton.ts) — se empareja con el partido de
  // verdad por la misma tripleta (ronda, pareja de jugadores sin orden) que ya usa el
  // propio bot. Cuenta cualquier entrevista de verdad completada (con Q&A real) — NO
  // hace falta que se haya convertido en artículo (pedido explícito, 2026-09-17: "I
  // dont think they meant only when its published on articles" — el icono manda a la
  // ficha del propio partido, que enseña la transcripción directamente). Pedido
  // explícito de la comunidad (2026-09-17, hilo de Discord: "for every match that has
  // a interview, show a little icon to press and check the interview").
  const interviewRows = await db
    .select({ round: discordInterviewThreads.round, playerId: discordInterviewThreads.playerId, opponentId: discordInterviewThreads.opponentId, qa: discordInterviewThreads.qa })
    .from(discordInterviewThreads)
    .where(and(eq(discordInterviewThreads.editionId, editionId), eq(discordInterviewThreads.status, "completed")));
  const interviewKey = (round: string, a: number, b: number) => `${round}:${Math.min(a, b)}:${Math.max(a, b)}`;
  const interviewMatches = new Set(interviewRows.filter((r) => r.qa.length > 0).map((r) => interviewKey(r.round, r.playerId, r.opponentId)));

  const bracketMatches: TournamentBracketMatch[] = matchRows.map((m) => ({
    id: m.id,
    round: m.round,
    player1Id: m.player1Id!,
    player2Id: m.player2Id!,
    winnerId: m.winnerId!,
    // Filas de antes de que existiera esta columna (nullable a propósito, ver
    // db/schema.ts) caen de vuelta en el id — peor que sortIndex real, pero nunca
    // rompe: son datos ya reparseados en cuanto se relance `npm run load`.
    sortIndex: m.sortIndex ?? m.id,
    outcome: m.outcome as MatchCardData["outcome"],
    player1: {
      id: m.player1Id!,
      displayName: m.player1Name,
      country: m.player1Country,
      seed: m.player1Seed,
    },
    player2: {
      id: m.player2Id!,
      displayName: m.player2Name,
      country: m.player2Country,
      seed: m.player2Seed,
    },
    sets: setsByMatch.get(m.id) ?? [],
    youtubeVideoId: videoByMatch.get(m.id) ?? null,
    hasStats: matchIdsWithStats.has(m.id),
    hasInterview: interviewMatches.has(interviewKey(m.round, m.player1Id!, m.player2Id!)),
  }));

  // Un bye nunca tiene fila propia en `matches` (nunca fue un partido) — sin tarjeta
  // propia, el cuadro se ve incompleto en las rondas tempranas y los conectores de la
  // ronda siguiente no tienen de dónde salir (pedido explícito: replicar el cuadro de
  // la referencia, que sí enseña "Bye" como su propia tarjeta). Antes esto se
  // ADIVINABA (`findByeSlots`, a partir de en qué ronda reaparece cada jugador) —
  // adivinanza que se rompía en cuadros irregulares (Cincinnati 2026, Trn=2092: un
  // jugador que entra directo en R2 sin bye en R1 es indistinguible de "tuvo un bye en
  // R1" con solo esa pista). Ahora sale directo de `byes`, capturado tal cual en el
  // cuadro fuente durante el parseo — dato real, no inferencia.
  const byeMatches: TournamentBracketMatch[] = byeRows.map((b, i) => ({
    id: -1 - i,
    round: b.round,
    player1Id: b.playerId,
    player2Id: BYE_PLAYER_ID,
    winnerId: b.playerId,
    sortIndex: b.sortIndex,
    outcome: "bye",
    player1: { id: b.playerId, displayName: b.displayName, country: b.country, seed: b.seed },
    player2: { id: BYE_PLAYER_ID, displayName: "Bye", country: null, seed: null },
    sets: [],
    youtubeVideoId: null,
  }));

  // Cruces del cuadro todavía sin resolver — ni partido ni bye. Los dos lados pueden
  // ser un jugador real ya emparejado (resultado pendiente) o "TBD" si ni eso se sabe
  // todavía (`TBD_PLAYER_ID`, mismo criterio que `BYE_PLAYER_ID`). Pedido explícito:
  // el cuadro se enseña completo desde el principio, con huecos "TBD" en vez de no
  // mostrar la tarjeta — esto es lo que hace que las rondas futuras (Q/S/F de un
  // torneo a medias) aparezcan también, no solo las que ya tienen algún partido.
  const pendingMatches: TournamentBracketMatch[] = pendingRows.map((p, i) => ({
    id: -100000 - i,
    round: p.round,
    player1Id: p.player1Id ?? TBD_PLAYER_ID,
    player2Id: p.player2Id ?? TBD_PLAYER_ID,
    winnerId: null,
    sortIndex: p.sortIndex,
    outcome: "pending",
    player1:
      p.player1Id !== null
        ? { id: p.player1Id, displayName: p.player1Name!, country: p.player1Country, seed: p.player1Seed }
        : { id: TBD_PLAYER_ID, displayName: "TBD", country: null, seed: null },
    player2:
      p.player2Id !== null
        ? { id: p.player2Id, displayName: p.player2Name!, country: p.player2Country, seed: p.player2Seed }
        : { id: TBD_PLAYER_ID, displayName: "TBD", country: null, seed: null },
    sets: [],
    youtubeVideoId: null,
  }));

  const allBracketMatches = [...bracketMatches, ...byeMatches, ...pendingMatches];

  // La previa (Q1/Q2/Q3) es un cuadrito PROPIO y mucho más pequeño que alimenta al
  // cuadro principal, no una ronda más de él — mezclar las dos en el mismo
  // `BracketColumns` rompía la geometría de verdad (lib/bracketGeometry.ts asume que
  // cada ronda de la ventana desciende de la anterior; con una previa de 2 partidos
  // seguida del R1 completo de 16, casi ningún partido de R1 encuentra ahí un
  // alimentador real y todos caían apilados en el mismo sitio — bug real reportado,
  // "broken"). Cada una en su propio `BracketColumns` (mismo componente, sin tocar)
  // sí cumple la asunción por separado.
  const qualifyingRoundRe = /^Q\d$/;
  const qualifyingMatches = allBracketMatches.filter((m) => qualifyingRoundRe.test(m.round));
  const mainDrawMatches = allBracketMatches.filter((m) => !qualifyingRoundRe.test(m.round));

  const status = deriveTournamentStatus(
    matchRows,
    matchRows.length + byeRows.length + pendingRows.length > 0,
  );

  // Solo un torneo TODAVÍA en juego trae esto (Mana deja de publicarlo en cuanto
  // termina, ver lib/mana/loadTournament.ts y docs/decisiones.md 2026-09-05) — un
  // torneo completado da aquí un array vacío sin más comprobación.
  const deadlineRows = await db
    .select({ round: editionRoundDeadlines.round, deadlineAt: editionRoundDeadlines.deadlineAt })
    .from(editionRoundDeadlines)
    .where(eq(editionRoundDeadlines.editionId, editionId))
    .orderBy(asc(editionRoundDeadlines.deadlineAt));
  const roundLadder = fullRoundLadder(edition.drawSize);
  // Un cruce sin decidir todavía vive en `pendingSlots`, nunca en `matches` (esa tabla
  // solo guarda resultados ya jugados) — así que en cuanto una ronda deja de tener
  // ninguna fila ahí, todos sus cruces ya tienen partido real y su plazo deja de
  // importar, aunque Mana siga publicándolo mientras el TORNEO entero no haya
  // terminado (ver el comentario de arriba). Pedido explícito: quitar el plazo de una
  // ronda ya completa en vez de dejarlo colgando junto a las rondas de verdad en juego.
  const roundsStillPending = new Set(pendingRows.map((p) => p.round));
  const roundDeadlines = deadlineRows
    .filter((d) => roundsStillPending.has(d.round))
    .map((d) => ({
      round: d.round,
      roundLabel: roundDisplayLabel(roundLadder, d.round),
      deadlineAt: d.deadlineAt.toISOString(),
    }));

  return (
    <div>
      {/* Solo mientras el torneo está en juego de verdad — uno ya terminado no va a
       * cambiar, refrescarlo solo cada 10 min sería tráfico sin ningún dato nuevo que
       * traer (pedido explícito del propietario). */}
      {status === "ongoing" && <AutoRefresh />}
      <PageMasthead
        eyebrow={`${[edition.category, surfaceDisplayLabel(edition.surface)].filter(Boolean).join(" · ")} · ${edition.year}${
          edition.isoWeek ? ` · Week ${edition.isoWeek}` : ""
        }`}
        title={edition.eventName}
        subtitle={
          <>
            <TournamentStatusBadge status={status} />
            <span>Draw of {edition.drawSize}</span>
          </>
        }
        accentColor={surfaceColor(edition.surface)}
        backgroundImageUrl={getTournamentHeaderUrl(edition.eventName)}
      />

      <div className="tour-container py-8">
        <div className="min-w-0">
          <NextOpponentPanel editionId={editionId} />
          <RoundDeadlines deadlines={roundDeadlines} />

          {qualifyingMatches.length > 0 && (
            <h2 className="text-headline mb-4 text-lg text-ink">Main Draw</h2>
          )}
          <BracketColumns matches={mainDrawMatches} drawSize={edition.drawSize} editionId={edition.id} />

          {qualifyingMatches.length > 0 && (
            <div className="mt-10">
              <h2 className="text-headline mb-4 text-lg text-ink">Qualifying</h2>
              <BracketColumns matches={qualifyingMatches} drawSize={edition.drawSize} editionId={edition.id} />
            </div>
          )}

          {edition.officialTopicUrl && (
            <p className="text-muted-label mt-8 text-xs">
              Source:{" "}
              <a
                href={edition.officialTopicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                official tournament thread on the Mana Games forum
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface FinalsMatchLike {
  id: number;
  player1: { id: number; displayName: string; country: string | null } | null;
  player2: { id: number; displayName: string; country: string | null } | null;
  winnerId: number | null;
  outcome: "scheduled" | "played" | "retired" | "disqualified";
  sets: { winnerGames: number; loserGames: number; tiebreakLoserPoints: number | null }[];
  mirroredMatchId: number | null;
}

/** `GroupMatchDisplay`/`KnockoutMatchDisplay` (lib/finals/queries.ts) -> `MatchCardData`
 * — mismo `MatchCard` que el cuadro normal, sin duplicar su render. Grupo nunca tiene
 * lado vacío (`GroupMatchDisplay.player1/2` no son nulos, el fixture ya empareja a los
 * 4 del grupo desde el principio); eliminatoria sí, hasta que su semifinal alimentadora
 * se decide — mismo `TBD_PLAYER_ID` que ya usa el cuadro de eliminación directa. Sin
 * seed propio en la tarjeta: el "seed" de grupo (1-8) no es el mismo concepto que un
 * seed de cuadro y confundiría más que ayudar (mismo criterio ya aplicado en
 * lib/liveTennis/resolveAgainstOngoing.ts). `id` es el espejo (`matches.id`) cuando
 * existe — es el que de verdad usa el botón "Estadísticas" del pie de la tarjeta
 * (`/tournaments/<id>/matches/<matchId>`, cuelga de `match_stats`, nunca de
 * `finals_matches` directamente) — y si no, el propio id de `finals_matches` (nunca se
 * muestra, solo hace falta como `key`).
 */
function finalsMatchToCardData(m: FinalsMatchLike): MatchCardData {
  const toPlayer = (p: FinalsMatchLike["player1"]): MatchCardPlayer =>
    p ? { id: p.id, displayName: p.displayName, country: p.country, seed: null } : { id: TBD_PLAYER_ID, displayName: "TBD", country: null, seed: null };
  return {
    id: m.mirroredMatchId ?? m.id,
    player1: toPlayer(m.player1),
    player2: toPlayer(m.player2),
    winnerId: m.winnerId,
    outcome: m.outcome === "scheduled" ? "pending" : m.outcome,
    sets: m.sets.map((s, i) => ({ setNumber: i + 1, winnerGames: s.winnerGames, loserGames: s.loserGames, tiebreakLoserPoints: s.tiebreakLoserPoints })),
    youtubeVideoId: null,
    hasStats: m.mirroredMatchId !== null,
    // `hasInterview` se omite a propósito (queda `undefined`, mismo trato que
    // `hasStats` en un bye/pending) — las entrevistas post-partido son un mecanismo
    // genérico de torneo real (editionId + ronda + pareja de jugadores, ver
    // lib/tournamentBracketData.ts) que esta conversión no tiene a mano en este punto
    // (FinalsMatchLike no trae ronda ni editionId) — caso raro en la práctica (nadie
    // ha pedido entrevistas de Finals todavía), no se inventa uno.
  };
}

/** `KnockoutMatchDisplay` (lib/finals/queries.ts) -> `KnockoutSlotMatch` — la única
 * conversión real es `statsHref` (`FinalsMatchCard` la recibe ya resuelta, a
 * diferencia de `MatchCard`, que la construye ella misma a partir de un `editionId`
 * suelto). El resto de campos ya encajan tal cual, `sets`/`outcome`/jugadores incluidos
 * — `KnockoutMatchDisplay` se diseñó pensando en esta misma tarjeta desde el principio. */
function toKnockoutSlotMatch(m: Awaited<ReturnType<typeof getKnockoutMatches>>[number], editionId: number): KnockoutSlotMatch {
  return {
    id: m.id,
    slot: m.slot,
    label: m.label,
    player1: m.player1,
    player2: m.player2,
    winnerId: m.winnerId,
    outcome: m.outcome,
    sets: m.sets,
    statsHref: m.mirroredMatchId !== null ? `/tournaments/${editionId}/matches/${m.mirroredMatchId}` : null,
  };
}

function FinalsGroupColumn({
  label,
  standings,
  matches: groupMatches,
  editionId,
}: {
  label: "A" | "B";
  standings: Awaited<ReturnType<typeof getGroupStandingsRows>>;
  matches: Awaited<ReturnType<typeof getGroupMatches>>;
  editionId: number;
}) {
  if (standings.length === 0) return null;
  return (
    <div>
      <GroupStandingsTable groupLabel={label} rows={standings} />
      {/* Ancho propio (no `flex flex-wrap` a lo ancho de la tabla) y centrado debajo de
       * ella — pedido explícito: "match cards should be centered with its group stage,
       * with 2 cards per row". `632px` cabe justo 2 tarjetas de `MATCH_CARD_WIDTH`
       * (300) más el hueco entre ellas (`gap-4`, 16px) con un poco de margen. */}
      <div className="mx-auto mt-4 grid max-w-[632px] grid-cols-1 gap-4 sm:grid-cols-2">
        {groupMatches.map((m) => (
          <MatchCard key={m.id} data={finalsMatchToCardData(m)} editionId={editionId} />
        ))}
      </div>
    </div>
  );
}

/**
 * Rama de esta misma página para una edición espejo de Finals — grupos (tabla +
 * partidos) y eliminatoria (2 semis + final, siempre 3 cruces fijos, nunca hace falta
 * la reconstrucción genérica de `lib/bracket.ts`), en vez del cuadro normal. Ver el
 * comentario en `TournamentPage` sobre por qué esto vive aquí y no en una ruta propia.
 */
async function renderFinalsPage(
  edition: {
    id: number;
    year: number;
    surface: string | null;
    officialTopicUrl: string | null;
    eventName: string;
  },
  finalsEditionId: number,
  kind: string,
) {
  const format = getFinalsFormat(kind);
  const [groupAStandings, groupBStandings, groupAMatches, groupBMatches, knockoutMatches, deadlineRows] = await Promise.all([
    getGroupStandingsRows(finalsEditionId, "A", format),
    getGroupStandingsRows(finalsEditionId, "B", format),
    getGroupMatches(finalsEditionId, "A"),
    getGroupMatches(finalsEditionId, "B"),
    getKnockoutMatches(finalsEditionId),
    db
      .select({ round: editionRoundDeadlines.round, deadlineAt: editionRoundDeadlines.deadlineAt })
      .from(editionRoundDeadlines)
      .where(eq(editionRoundDeadlines.editionId, edition.id)),
  ]);

  // Un plazo por fase entera, no por partido — "RR" cubre los dos grupos a la vez
  // (lib/finals/mirror.ts::setFinalsRoundDeadline solo admite esas tres claves). Se
  // deja de enseñar en cuanto esa fase entera está decidida, igual que
  // `roundsStillPending` hace para un torneo normal (app/tournaments/[id]/page.tsx más
  // arriba) — antes de que la fase siguiente exista todavía (semis sin sembrar, p.ej.)
  // el plazo se sigue enseñando como próximo, no se esconde por "no ha empezado".
  const semifinals = knockoutMatches.filter((m) => m.slot !== "F");
  const final = knockoutMatches.find((m) => m.slot === "F");
  const PHASE_PENDING: Record<"RR" | "S" | "F", boolean> = {
    RR: knockoutMatches.length === 0,
    S: !(semifinals.length === 2 && semifinals.every((m) => m.outcome !== "scheduled")),
    F: !(final && final.outcome !== "scheduled"),
  };
  const PHASE_LABEL: Record<"RR" | "S" | "F", string> = { RR: "Round Robin", S: "Semifinals", F: "Final" };
  const roundDeadlines = deadlineRows
    .filter((d): d is { round: "RR" | "S" | "F"; deadlineAt: Date } => d.round in PHASE_PENDING && PHASE_PENDING[d.round as "RR" | "S" | "F"])
    .map((d) => ({ round: d.round, roundLabel: PHASE_LABEL[d.round], deadlineAt: d.deadlineAt.toISOString() }))
    .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt));

  return (
    <div>
      <PageMasthead
        eyebrow={[format.label, surfaceDisplayLabel(edition.surface), String(edition.year)].filter(Boolean).join(" · ")}
        title={edition.eventName}
        subtitle="Season finale"
        accentColor={surfaceColor(edition.surface)}
        backgroundImageUrl={getTournamentHeaderUrl(edition.eventName)}
      />

      <div className="tour-container py-8">
        <div className="min-w-0">
          <NextOpponentPanel editionId={edition.id} />
          <RoundDeadlines deadlines={roundDeadlines} />

          {(groupAStandings.length > 0 || groupBStandings.length > 0) && (
            <>
              <h2 className="text-headline mb-4 text-lg text-ink">Group Stage</h2>
              {/* Apiladas, no lado a lado — pedido explícito: "bigger group stages".
               * Lado a lado (como antes) apretaba cada grupo a la mitad del ancho
               * disponible, justo cuando además hace falta sitio para 2 tarjetas de
               * partido por fila debajo de la tabla. Apiladas, cada grupo tiene el
               * ancho completo de la columna de contenido. */}
              <div className="mb-10 flex flex-col gap-10">
                <FinalsGroupColumn label="A" standings={groupAStandings} matches={groupAMatches} editionId={edition.id} />
                <FinalsGroupColumn label="B" standings={groupBStandings} matches={groupBMatches} editionId={edition.id} />
              </div>
            </>
          )}

          {knockoutMatches.length > 0 && (
            <div>
              <h2 className="text-headline mb-4 text-lg text-ink">Knockout Stage</h2>
              <FinalsKnockoutBracket matches={knockoutMatches.map((m) => toKnockoutSlotMatch(m, edition.id))} />
            </div>
          )}

          {groupAStandings.length === 0 && groupBStandings.length === 0 && knockoutMatches.length === 0 && (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
              Groups haven&rsquo;t been drawn yet.
            </p>
          )}

          {edition.officialTopicUrl && (
            <p className="text-muted-label mt-8 text-xs">
              Source:{" "}
              <a
                href={edition.officialTopicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                official tournament thread on the Mana Games forum
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
