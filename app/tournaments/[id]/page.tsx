import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { editions, events, matches, players, sets } from "@/db/schema";
import { surfaceColor } from "@/lib/surfaceColors";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { BracketColumns, type TournamentBracketMatch } from "@/components/tournament/BracketColumns";
import type { MatchCardData } from "@/components/tournament/MatchCard";

export const revalidate = 3600;

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
      player1Country: p1.country,
      player2Name: p2.displayName,
      player2Country: p2.country,
    })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(eq(matches.editionId, editionId));

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

  const bracketMatches: TournamentBracketMatch[] = matchRows.map((m) => ({
    id: m.id,
    round: m.round,
    player1Id: m.player1Id!,
    player2Id: m.player2Id!,
    winnerId: m.winnerId!,
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
  }));

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.category} · ${edition.surface} · ${edition.year}${
          edition.isoWeek ? ` · Week ${edition.isoWeek}` : ""
        }`}
        title={edition.eventName}
        subtitle={`Draw of ${edition.drawSize}`}
        accentColor={surfaceColor(edition.surface)}
      />

      <div className="tour-container py-8">
        <BracketColumns matches={bracketMatches} />

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
  );
}
