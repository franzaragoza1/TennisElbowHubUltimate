import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { editions, events, nativeTournamentRegistrations, players } from "@/db/schema";
import { deriveTournamentStatus } from "@/lib/tournamentStatus";
import { getBracketMatchesForEdition, getDecidablePendingSlots } from "@/lib/tournamentBracketData";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { BracketColumns } from "@/components/tournament/BracketColumns";
import { RegistrationSearch } from "@/components/admin/native-tournaments/RegistrationSearch";
import { ResultEntryForm } from "@/components/admin/native-tournaments/ResultEntryForm";
import { generateDraw, withdrawRegistration } from "@/app/admin/native-tournaments/[id]/actions";

export const dynamic = "force-dynamic";

export default async function AdminNativeTournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const editionId = Number(id);
  if (!Number.isInteger(editionId)) notFound();

  const [edition] = await db
    .select({ id: editions.id, eventName: events.displayName, year: editions.year, category: editions.category, drawSize: editions.drawSize })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(eq(editions.id, editionId));
  if (!edition) notFound();

  const registrations = await db
    .select({
      registrationId: nativeTournamentRegistrations.id,
      playerId: players.id,
      displayName: players.displayName,
      seed: nativeTournamentRegistrations.seed,
    })
    .from(nativeTournamentRegistrations)
    .innerJoin(players, eq(players.id, nativeTournamentRegistrations.playerId))
    .where(eq(nativeTournamentRegistrations.editionId, editionId));

  const bracketMatches = await getBracketMatchesForEdition(editionId);
  const hasDraw = bracketMatches.length > 0;
  const status = deriveTournamentStatus(bracketMatches.filter((m) => m.outcome !== "bye" && m.outcome !== "pending"), hasDraw);
  const decidable = hasDraw ? await getDecidablePendingSlots(editionId) : [];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="text-headline text-2xl text-ink">
            {edition.eventName} {edition.year}
          </h1>
          <p className="text-muted-label text-xs">
            {edition.category} · Draw of {edition.drawSize}
          </p>
        </div>
        <TournamentStatusBadge status={status} />
      </div>

      {!hasDraw && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Registrations</h2>
          <RegistrationSearch editionId={editionId} />

          <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-paper">
            {registrations.length === 0 ? (
              <p className="text-muted-label px-4 py-8 text-center text-sm">Nobody registered yet.</p>
            ) : (
              registrations.map((r) => (
                <div key={r.registrationId} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                  <span className="text-ink">
                    {r.displayName}
                    {r.seed !== null && <span className="text-muted-label"> · Seed {r.seed}</span>}
                  </span>
                  <form action={withdrawRegistration}>
                    <input type="hidden" name="registrationId" value={r.registrationId} />
                    <input type="hidden" name="editionId" value={editionId} />
                    <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
                      Withdraw
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <form action={generateDraw} className="mt-4">
            <input type="hidden" name="editionId" value={editionId} />
            <button
              type="submit"
              disabled={registrations.length < edition.drawSize / 2}
              className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate draw
            </button>
            {registrations.length < edition.drawSize / 2 && (
              <p className="text-muted-label mt-2 text-xs">
                Needs at least {edition.drawSize / 2} registered players (has {registrations.length}).
              </p>
            )}
          </form>
        </section>
      )}

      {hasDraw && (
        <>
          <section className="mb-8">
            <BracketColumns matches={bracketMatches} drawSize={edition.drawSize} editionId={edition.id} />
          </section>

          {decidable.length > 0 && (
            <section>
              <h2 className="text-headline mb-3 text-lg text-ink">Enter results</h2>
              <div className="flex flex-col gap-2">
                {decidable.map((slot) => (
                  <ResultEntryForm
                    key={slot.id}
                    pendingSlotId={slot.id}
                    round={slot.round}
                    player1={{ id: slot.player1Id!, name: slot.player1Name! }}
                    player2={{ id: slot.player2Id!, name: slot.player2Name! }}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
