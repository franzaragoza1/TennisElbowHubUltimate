import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { editions, events } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { SignInButton } from "@/components/account/SignInButton";
import { PredictionBracket } from "@/components/tournament/PredictionBracket";
import { PredictionBracketDevWrapper } from "@/components/tournament/PredictionBracketDevWrapper";
import { PredictionLeaderboardTable } from "@/components/tournament/PredictionLeaderboardTable";
import { getCurrentUser } from "@/lib/auth";
import { isPredictionEligible, getPredictionLockInfo, getMyPrediction, getPredictionLeaderboard } from "@/lib/predictions/queries";
import { canUseDevPreview } from "@/lib/predictions/devPreview";
import { scorePrediction } from "@/lib/predictions/scoring";
import { buildBracketLayout } from "@/lib/bracket";
import { excludeQualifyingRounds, getBracketMatchesForEdition } from "@/lib/tournamentBracketData";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";

export const revalidate = 60;

export default async function PredictPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const editionId = Number(id);
  if (!Number.isInteger(editionId)) notFound();

  const [edition, eligible, user] = await Promise.all([
    db
      .select({ id: editions.id, drawSize: editions.drawSize, surface: editions.surface, category: editions.category, eventName: events.displayName })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .where(eq(editions.id, editionId))
      .then((rows) => rows[0]),
    isPredictionEligible(editionId),
    getCurrentUser(),
  ]);
  if (!edition) notFound();

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.eventName} · ${[edition.category, surfaceDisplayLabel(edition.surface)].filter(Boolean).join(" · ")}`}
        title="Bracket Predictions"
        subtitle={
          <Link href={`/tournaments/${edition.id}`} className="hover:underline">
            ← Back to the draw
          </Link>
        }
        accentColor={edition.surface ? surfaceColor(edition.surface) : undefined}
      />

      <div className="tour-container min-w-0 py-8">
        {!eligible ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
            Predictions aren&apos;t open for this tournament yet.
          </p>
        ) : !user ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper-tint px-4 py-3">
            <p className="text-sm text-muted-label">Sign in to fill out your bracket.</p>
            <SignInButton callbackUrl={`/tournaments/${editionId}/predict`} />
          </div>
        ) : (
          <EligiblePredictBody editionId={editionId} drawSize={edition.drawSize} userId={user.id} />
        )}
      </div>
    </div>
  );
}

async function EligiblePredictBody({ editionId, drawSize, userId }: { editionId: number; drawSize: number; userId: string }) {
  const [lockInfo, myPicks, allMatches, devPreview] = await Promise.all([
    getPredictionLockInfo(editionId),
    getMyPrediction(editionId, userId),
    getBracketMatchesForEdition(editionId).then(excludeQualifyingRounds),
    canUseDevPreview(),
  ]);

  const scoreSummary = lockInfo.locked && myPicks ? scorePrediction(myPicks, buildBracketLayout(allMatches)) : null;
  const leaderboard = lockInfo.locked ? await getPredictionLeaderboard(editionId) : [];

  return (
    <div>
      {lockInfo.locked && !myPicks && (
        <p className="text-muted-label mb-6 rounded-lg border border-rule bg-paper px-4 py-6 text-center text-sm">
          Predictions locked before you submitted a bracket for this tournament.
        </p>
      )}

      {scoreSummary && (
        <div className="mb-6 rounded-lg border border-rule bg-paper p-5">
          <p className="text-eyebrow mb-3 text-xs text-muted-label">Your score</p>
          <p className="text-headline mb-3 text-3xl text-ink">{scoreSummary.total} pts</p>
          <div className="flex flex-wrap gap-3">
            {scoreSummary.byRound.map((r) => (
              <span key={r.round} className="text-eyebrow rounded-full border border-rule px-3 py-1 text-[10px] text-muted-label">
                {r.round}: {r.correct}/{r.possible} · {r.points}pt
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Una sola instancia estable mientras no bloquea (nunca dos ramas mutuamente
       * excluyentes por `myPicks`) — un envío que pasa `myPicks` de null a poblado
       * intercambiaría de rama y remontaría `PredictionBracket` en el mismo instante,
       * borrando el mensaje "Bracket submitted" antes de que nadie llegue a verlo (bug
       * real encontrado en la verificación E2E, 2026-09-17). Aquí solo cambia la prop
       * `initialPicks`, nunca la identidad del elemento. */}
      {!lockInfo.locked && (
        <div className="mb-8">
          <PredictionBracketDevWrapper canPreview={devPreview} matches={allMatches} drawSize={drawSize} editionId={editionId} initialPicks={myPicks} locked={false} />
        </div>
      )}
      {lockInfo.locked && myPicks && (
        <div className="mb-8">
          <PredictionBracket matches={allMatches} drawSize={drawSize} editionId={editionId} initialPicks={myPicks} locked={true} />
        </div>
      )}

      {lockInfo.locked && leaderboard.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-eyebrow text-xs text-muted-label">Leaderboard</p>
            <Link href="/predictions/rankings" className="text-eyebrow text-xs text-blue-500 hover:underline">
              Global rankings →
            </Link>
          </div>
          <PredictionLeaderboardTable rows={leaderboard} editionId={editionId} />
        </div>
      )}
    </div>
  );
}
