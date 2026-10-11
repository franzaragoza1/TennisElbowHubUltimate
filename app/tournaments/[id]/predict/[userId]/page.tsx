import { eq } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { authUsers, editions, events } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { PredictionBracket } from "@/components/tournament/PredictionBracket";
import { getCurrentUser } from "@/lib/auth";
import { getPredictionLockInfo, getMyPrediction } from "@/lib/predictions/queries";
import { scorePrediction } from "@/lib/predictions/scoring";
import { buildBracketLayout } from "@/lib/bracket";
import { excludeQualifyingRounds, getBracketMatchesForEdition } from "@/lib/tournamentBracketData";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";

export const revalidate = 60;

/**
 * Cuadro completo de UN predictor concreto — pedido explícito del propietario,
 * 2026-09-18: "there should be the possibility, after submitting, to view the others
 * full bracket picks". Confirmado: solo una vez BLOQUEADO el torneo entero (mismo
 * criterio que ya destapa el marcador/leaderboard) — antes de eso, los picks de otro
 * siguen siendo editables por su dueño, y enseñarlos dejaría de ser una predicción a
 * ciegas de verdad (alguien podría copiar o contrapicar contra lo que ve). Nunca exige
 * que QUIEN MIRA haya enviado su propio bracket — mismo alcance que el leaderboard, que
 * ya es visible a cualquiera con sesión iniciada en esta página sin esa condición.
 */
export default async function PredictorBracketPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  preloadSidebar();
  const { id, userId } = await params;
  const editionId = Number(id);
  if (!Number.isInteger(editionId)) notFound();

  const viewer = await getCurrentUser();
  if (!viewer) notFound();

  const [edition, targetUser, lockInfo] = await Promise.all([
    db
      .select({ id: editions.id, drawSize: editions.drawSize, surface: editions.surface, category: editions.category, eventName: events.displayName })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .where(eq(editions.id, editionId))
      .then((rows) => rows[0]),
    db.select({ name: authUsers.name, image: authUsers.image }).from(authUsers).where(eq(authUsers.id, userId)).then((rows) => rows[0]),
    getPredictionLockInfo(editionId),
  ]);
  if (!edition || !targetUser) notFound();
  // Antes de que el torneo bloquee del todo, ni siquiera con la URL a mano se puede ver
  // — mismo motivo que arriba, esto no es un enlace secundario opcional, es la regla.
  if (!lockInfo.locked) notFound();

  const [picks, allMatches] = await Promise.all([getMyPrediction(editionId, userId), getBracketMatchesForEdition(editionId).then(excludeQualifyingRounds)]);
  if (!picks) notFound();

  const scoreSummary = scorePrediction(picks, buildBracketLayout(allMatches));

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.eventName} · ${[edition.category, surfaceDisplayLabel(edition.surface)].filter(Boolean).join(" · ")}`}
        title={`${targetUser.name ?? "Anonymous"}'s Bracket`}
        subtitle={
          <Link href={`/tournaments/${edition.id}/predict`} className="hover:underline">
            ← Back to predictions
          </Link>
        }
        accentColor={edition.surface ? surfaceColor(edition.surface) : undefined}
      />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-rule bg-paper p-5">
            {targetUser.image ? (
              <Image src={targetUser.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" unoptimized />
            ) : (
              <span className="h-10 w-10 shrink-0 rounded-full bg-rule" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-headline truncate text-ink">{targetUser.name ?? "Anonymous"}</p>
              <p className="text-muted-label text-xs">{scoreSummary.byRound.map((r) => `${r.round}: ${r.correct}/${r.possible}`).join(" · ")}</p>
            </div>
            <p className="text-headline shrink-0 text-2xl text-ink">{scoreSummary.total} pts</p>
          </div>

          <div className="mb-8">
            <PredictionBracket matches={allMatches} drawSize={edition.drawSize} editionId={edition.id} initialPicks={picks} locked={true} />
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
