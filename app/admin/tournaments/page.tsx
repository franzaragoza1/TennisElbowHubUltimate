import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarTournaments } from "@/db/schema";
import { getOpenTournamentsForAdmin, minutesSince, timeAgo } from "@/lib/adminDashboard";
import { TournamentsSection } from "@/components/admin/sections/TournamentsSection";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { RefreshTournamentButton } from "@/components/admin/tournaments/RefreshTournamentButton";

function ago(date: Date | null): string {
  return date ? `refreshed ${timeAgo(date)}` : "never refreshed";
}

/**
 * Torneos en el panel (2026-10-17): primero lo que está vivo — cada torneo abierto con su
 * última recarga y un botón para recargarlo ya —, después lo anunciado en el calendario de
 * Mana sin ficha todavía, y abajo lo de siempre (añadir a mano, cola, últimos cargados).
 */
export default async function AdminTournamentsPage() {
  const [open, calendar] = await Promise.all([
    getOpenTournamentsForAdmin(),
    db.select().from(calendarTournaments).orderBy(asc(calendarTournaments.isoYear), asc(calendarTournaments.isoWeek)),
  ]);

  return (
    <div>
      <h1 className="text-headline text-2xl text-ink">Tournaments</h1>
      <p className="text-muted-label mb-6 text-xs">
        New tournaments are found and loaded automatically, and open ones refresh every 10 minutes. Use Refresh to reload one now.
      </p>

      <h2 className="text-eyebrow mb-3 text-[11px] text-muted-label">Open now</h2>
      {open.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-6 text-center text-sm">No open tournaments.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {open.map((t) => {
            const stale = minutesSince(t.refreshedAt) > 30;
            return (
              <div key={t.editionId} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-4 py-3 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <Link href={`/tournaments/${t.editionId}`} prefetch={false} className="text-headline text-ink hover:text-blue-500">
                    {t.eventName}
                  </Link>
                  <p className="text-muted-label text-xs">
                    {t.category} · {t.isoWeek ? `Week ${t.isoWeek}` : "no week"} · Trn={t.externalId}
                    {" · "}
                    {t.status === "ongoing"
                      ? `${t.matches} played, ${t.pendingSlots} to play`
                      : `queue ${t.queueCount ?? 0}${t.queueCapacity ? `/${t.queueCapacity}` : ""}`}
                  </p>
                </div>
                <TournamentStatusBadge status={t.status} />
                <span className={`text-xs ${stale ? "text-down" : "text-muted-label"}`}>{ago(t.refreshedAt)}</span>
                <RefreshTournamentButton externalId={t.externalId} />
              </div>
            );
          })}
        </div>
      )}

      {calendar.length > 0 && (
        <>
          <h2 className="text-eyebrow mt-8 mb-3 text-[11px] text-muted-label">Announced on Mana&apos;s calendar (no page yet)</h2>
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {calendar.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                <span className="text-ink">{c.eventName}</span>
                <span className="text-muted-label text-xs">
                  {[c.category, c.surface, c.drawSize ? `${c.drawSize} draw` : null, `Week ${c.isoWeek}`].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-10 border-t border-rule pt-8">
        <TournamentsSection />
      </div>
    </div>
  );
}
