import { and, eq, notInArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { finalsEditions, finalsMatches, finalsParticipants, players } from "@/db/schema";
import { GroupAssignmentBoard } from "@/components/finals/GroupAssignmentBoard";
import { GroupStandingsTable } from "@/components/finals/GroupStandingsTable";
import { MatchResultForm } from "@/components/admin/finals/MatchResultForm";
import { QuickInputPanel } from "@/components/admin/finals/QuickInputPanel";
import { AlternateSubstitutionForm } from "@/components/admin/finals/AlternateSubstitutionForm";
import { getGroupStandingsRows, getKnockoutMatches } from "@/lib/finals/queries";
import { getFinalsFormat } from "@/lib/finals/format";
import { startGroupStage } from "@/app/admin/finals/actions";

export const dynamic = "force-dynamic";

export default async function AdminFinalsEditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const finalsEditionId = Number(id);
  if (!Number.isInteger(finalsEditionId)) notFound();

  const [edition] = await db.select().from(finalsEditions).where(eq(finalsEditions.id, finalsEditionId));
  if (!edition) notFound();

  const participantRows = await db
    .select({
      id: finalsParticipants.id,
      playerId: finalsParticipants.playerId,
      seed: finalsParticipants.seed,
      group: finalsParticipants.group,
      status: finalsParticipants.status,
      displayName: players.displayName,
    })
    .from(finalsParticipants)
    .innerJoin(players, eq(players.id, finalsParticipants.playerId))
    .where(eq(finalsParticipants.finalsEditionId, finalsEditionId));
  participantRows.sort((a, b) => a.seed - b.seed);

  const activeParticipants = participantRows.filter((p) => p.status === "active");

  const takenPlayerIds = participantRows.map((p) => p.playerId);
  const candidateRows =
    takenPlayerIds.length > 0
      ? await db.select({ id: players.id, displayName: players.displayName }).from(players).where(notInArray(players.id, takenPlayerIds))
      : await db.select({ id: players.id, displayName: players.displayName }).from(players);

  const isSetup = edition.status === "setup";

  let scheduledGroupMatches: { id: number; group: string | null; player1: { id: number; displayName: string }; player2: { id: number; displayName: string } }[] = [];
  if (!isSetup) {
    const rows = await db
      .select()
      .from(finalsMatches)
      .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.stage, "group"), eq(finalsMatches.outcome, "scheduled")));
    const nameById = new Map(participantRows.map((p) => [p.playerId, p.displayName]));
    scheduledGroupMatches = rows.map((r) => ({
      id: r.id,
      group: r.group,
      player1: { id: r.player1Id!, displayName: nameById.get(r.player1Id!) ?? "Unknown" },
      player2: { id: r.player2Id!, displayName: nameById.get(r.player2Id!) ?? "Unknown" },
    }));
  }

  const format = getFinalsFormat(edition.kind);
  const [groupA, groupB, knockout] = isSetup
    ? [[], [], []]
    : await Promise.all([
        getGroupStandingsRows(finalsEditionId, "A", format),
        getGroupStandingsRows(finalsEditionId, "B", format),
        getKnockoutMatches(finalsEditionId),
      ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-headline text-2xl text-ink">{edition.displayName}</h1>
          <p className="text-muted-label text-xs">Status: {edition.status}</p>
        </div>
        <Link href={`/finals/${edition.id}`} className="text-eyebrow text-xs text-blue-500 hover:underline">
          View public page
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down">
          {error === "groups-incomplete" ? "Both groups need exactly 4 players before starting." : error}
        </p>
      )}

      {isSetup && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Group assignment</h2>
          <GroupAssignmentBoard
            participants={activeParticipants.map((p) => ({ id: p.id, displayName: p.displayName, seed: p.seed, group: p.group as "A" | "B" }))}
            locked={false}
          />
          <form action={startGroupStage} className="mt-4">
            <input type="hidden" name="finalsEditionId" value={finalsEditionId} />
            <button type="submit" className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800">
              Start group stage
            </button>
          </form>
        </section>
      )}

      {!isSetup && (
        <>
          <section className="mb-8">
            <h2 className="text-headline mb-3 text-lg text-ink">Standings</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GroupStandingsTable groupLabel="A" rows={groupA} />
              <GroupStandingsTable groupLabel="B" rows={groupB} />
            </div>
          </section>

          {scheduledGroupMatches.length > 0 && (
            <section className="mb-8">
              <h2 className="text-headline mb-3 text-lg text-ink">Group matches to play</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {scheduledGroupMatches.map((m) => (
                  <MatchResultForm key={m.id} matchId={m.id} label={`Group ${m.group}`} player1={m.player1} player2={m.player2} format={format} />
                ))}
              </div>
            </section>
          )}

          {knockout.filter((m) => m.outcome === "scheduled" && m.player1 && m.player2).length > 0 && (
            <section className="mb-8">
              <h2 className="text-headline mb-3 text-lg text-ink">Knockout matches to play</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {knockout
                  .filter((m) => m.outcome === "scheduled" && m.player1 && m.player2)
                  .map((m) => (
                    <MatchResultForm key={m.id} matchId={m.id} label={m.label} player1={m.player1!} player2={m.player2!} format={format} />
                  ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <QuickInputPanel finalsEditionId={finalsEditionId} />
          </section>
        </>
      )}

      <section>
        <h2 className="text-headline mb-3 text-lg text-ink">Alternates</h2>
        <div className="space-y-2">
          {activeParticipants.map((p) => (
            <AlternateSubstitutionForm key={p.id} participantId={p.id} displayName={`${p.displayName} (seed ${p.seed})`} candidates={candidateRows} />
          ))}
        </div>
      </section>
    </div>
  );
}
