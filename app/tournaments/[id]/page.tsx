import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { byes, editions, events, matches, matchVideos, pendingSlots, players, sets } from "@/db/schema";
import { surfaceColor } from "@/lib/surfaceColors";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { BracketColumns, type TournamentBracketMatch } from "@/components/tournament/BracketColumns";
import { BYE_PLAYER_ID, TBD_PLAYER_ID, type MatchCardData } from "@/components/tournament/MatchCard";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { deriveTournamentStatus } from "@/lib/tournamentStatus";
import { getTournamentHeaderUrl } from "@/lib/tournamentHeaders";
import { AutoRefresh } from "@/components/layout/AutoRefresh";

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
  const status = deriveTournamentStatus(
    matchRows,
    matchRows.length + byeRows.length + pendingRows.length > 0,
  );

  return (
    <div>
      {/* Solo mientras el torneo está en juego de verdad — uno ya terminado no va a
       * cambiar, refrescarlo solo cada 10 min sería tráfico sin ningún dato nuevo que
       * traer (pedido explícito del propietario). */}
      {status === "ongoing" && <AutoRefresh />}
      <PageMasthead
        eyebrow={`${[edition.category, edition.surface].filter(Boolean).join(" · ")} · ${edition.year}${
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

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <BracketColumns matches={allBracketMatches} drawSize={edition.drawSize} editionId={edition.id} />

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
        <Sidebar />
      </div>
    </div>
  );
}
