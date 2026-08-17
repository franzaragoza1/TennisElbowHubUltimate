import { eq, notInArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { finalsEditions, finalsParticipants, players } from "@/db/schema";
import { GroupAssignmentBoard } from "@/components/finals/GroupAssignmentBoard";
import { GroupStandingsTable } from "@/components/finals/GroupStandingsTable";
import { MatchResultForm } from "@/components/admin/finals/MatchResultForm";
import { QuickInputPanel } from "@/components/admin/finals/QuickInputPanel";
import { AlternateSubstitutionForm } from "@/components/admin/finals/AlternateSubstitutionForm";
import { getGroupMatches, getGroupStandingsRows, getKnockoutMatches } from "@/lib/finals/queries";
import { getFinalsFormat } from "@/lib/finals/format";
import { startGroupStage, updateFinalsEditionInfo } from "@/app/admin/finals/actions";

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

  const format = getFinalsFormat(edition.kind);
  const [groupA, groupB, groupMatchesA, groupMatchesB, knockout] = isSetup
    ? [[], [], [], [], []]
    : await Promise.all([
        getGroupStandingsRows(finalsEditionId, "A", format),
        getGroupStandingsRows(finalsEditionId, "B", format),
        getGroupMatches(finalsEditionId, "A"),
        getGroupMatches(finalsEditionId, "B"),
        getKnockoutMatches(finalsEditionId),
      ]);
  // Los dos grupos juntos, cada partido con su etiqueta — jugados y por jugar, no
  // solo los pendientes (pedido explícito: poder corregir un resultado ya metido).
  const allGroupMatches = [
    ...groupMatchesA.map((m) => ({ ...m, group: "A" as const })),
    ...groupMatchesB.map((m) => ({ ...m, group: "B" as const })),
  ];
  const editableKnockout = knockout.filter((m) => m.player1 && m.player2);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-headline text-2xl text-ink">{edition.displayName}</h1>
          <p className="text-muted-label mb-3 text-xs">
            Status: {edition.status} · {edition.kind === "tour_finals" ? "World Tour Finals" : "Next Gen Finals"} · {edition.year}
          </p>
          <form action={updateFinalsEditionInfo} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="finalsEditionId" value={finalsEditionId} />
            <input
              type="text"
              name="displayName"
              defaultValue={edition.displayName}
              className="w-64 rounded border border-rule px-2 py-1 text-sm text-ink"
            />
            <button type="submit" className="text-eyebrow rounded-full border border-rule px-3 py-1.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500">
              Rename
            </button>
          </form>
        </div>
        <Link href={`/finals/${edition.id}`} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
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

          {allGroupMatches.length > 0 && (
            <section className="mb-8">
              <h2 className="text-headline mb-3 text-lg text-ink">Group matches</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {allGroupMatches.map((m) => (
                  <MatchResultForm
                    key={m.id}
                    matchId={m.id}
                    label={`Group ${m.group}`}
                    player1={m.player1}
                    player2={m.player2}
                    format={format}
                    initialWinnerId={m.winnerId ?? undefined}
                    initialSets={m.sets}
                  />
                ))}
              </div>
            </section>
          )}

          {editableKnockout.length > 0 && (
            <section className="mb-8">
              <h2 className="text-headline mb-3 text-lg text-ink">Knockout matches</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {editableKnockout.map((m) => (
                  <MatchResultForm
                    key={m.id}
                    matchId={m.id}
                    label={m.label}
                    player1={m.player1!}
                    player2={m.player2!}
                    format={format}
                    initialWinnerId={m.winnerId ?? undefined}
                    initialSets={m.sets}
                  />
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
