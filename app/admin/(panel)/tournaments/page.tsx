import Link from "next/link";
import { getRecentlyLoadedTournaments } from "@/app/admin/tournaments/actions";
import { AddTournamentForm } from "@/components/admin/tournaments/AddTournamentForm";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const recent = await getRecentlyLoadedTournaments(20);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Tournaments</h1>
        <p className="text-muted-label text-xs">Add a new tournament from the site, or refresh one already imported.</p>
      </div>

      <AddTournamentForm />

      <section className="mt-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Recently loaded</h2>
        {recent.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            Nothing loaded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {recent.map((r) => (
              <Link
                key={r.editionId}
                href={`/tournaments/${r.editionId}`}
                className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0 hover:bg-paper-tint"
              >
                <span className="text-ink">
                  {r.eventName} {r.year}
                  {r.isoWeek ? ` · Week ${r.isoWeek}` : ""}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-label text-xs">Trn={r.externalId}</span>
                  {r.status === "completed" ? (
                    <span className="text-eyebrow text-[10px] text-muted-label">Completed</span>
                  ) : (
                    <TournamentStatusBadge status={r.status} />
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
