import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, events, sources } from "@/db/schema";
import { NATIVE_SOURCE_SLUG } from "@/lib/nativeTournaments/source";
import { deriveTournamentStatus } from "@/lib/tournamentStatus";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { CreateNativeTournamentForm } from "@/components/admin/native-tournaments/CreateNativeTournamentForm";

export const dynamic = "force-dynamic";

export default async function AdminNativeTournamentsPage() {
  const rows = await db
    .select({
      id: editions.id,
      eventName: events.displayName,
      year: editions.year,
      category: editions.category,
      drawSize: editions.drawSize,
      // Derivado igual que en /tournaments/[id] (lib/tournamentStatus.ts): sin
      // ronda 'F' decidida -> "ongoing" si ya hay cuadro, "registration" si no.
      hasDraw: sql<boolean>`EXISTS(
        SELECT 1 FROM matches m WHERE m.edition_id = ${editions.id}
        UNION SELECT 1 FROM byes b WHERE b.edition_id = ${editions.id}
        UNION SELECT 1 FROM pending_slots ps WHERE ps.edition_id = ${editions.id}
      )`,
      hasDecidedFinal: sql<boolean>`EXISTS(SELECT 1 FROM matches mf WHERE mf.edition_id = ${editions.id} AND mf.round = 'F')`,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(sources, eq(sources.id, editions.sourceId))
    .where(eq(sources.slug, NATIVE_SOURCE_SLUG))
    .orderBy(editions.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Native Tournaments</h1>
        <p className="text-muted-label text-xs">
          Tournaments run entirely inside the site — not scraped from anywhere, admin-managed start to finish.
        </p>
      </div>

      <CreateNativeTournamentForm />

      <section className="mt-8">
        <h2 className="text-headline mb-3 text-lg text-ink">All native tournaments</h2>
        {rows.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">None created yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {rows.map((r) => {
              const status = deriveTournamentStatus(r.hasDecidedFinal ? [{ round: "F" }] : [], r.hasDraw);
              return (
                <Link
                  key={r.id}
                  href={`/admin/native-tournaments/${r.id}`}
                  className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0 hover:bg-paper-tint"
                >
                  <span className="text-ink">
                    {r.eventName} {r.year} · {r.category} · Draw of {r.drawSize}
                  </span>
                  <TournamentStatusBadge status={status} />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
