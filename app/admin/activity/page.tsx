import Link from "next/link";
import { desc, eq, inArray, like, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { changeLog } from "@/db/schema";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "results", label: "Results" },
  { value: "corrections", label: "Corrections" },
  { value: "tournaments", label: "New tournaments" },
  { value: "rankings", label: "Rankings" },
  { value: "admin", label: "Admin actions" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

function whereFor(filter: Filter): SQL | undefined {
  switch (filter) {
    case "results":
      return eq(changeLog.kind, "tournament.result");
    case "corrections":
      return inArray(changeLog.kind, ["tournament.correction", "tournament.removed"]);
    case "tournaments":
      return inArray(changeLog.kind, ["tournament.new", "calendar.announced"]);
    case "rankings":
      return like(changeLog.kind, "ranking.%");
    case "admin":
      return eq(changeLog.source, "admin");
    default:
      return undefined;
  }
}

const KIND_LABEL: Record<string, string> = {
  "tournament.result": "Result",
  "tournament.correction": "Correction",
  "tournament.removed": "Removed",
  "tournament.new": "New tournament",
  "ranking.week": "Ranking",
  "ranking.race": "Race",
  "calendar.announced": "Calendar",
};

const KIND_TONE: Record<string, string> = {
  "tournament.correction": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "tournament.removed": "bg-down/15 text-down",
  "tournament.new": "bg-blue-500/10 text-blue-500",
};

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Registro de cambios (2026-10-18, paso 4 del rediseño del panel): qué cambió en los datos,
 * cuándo y quién o qué lo cambió — `change_log`, lo escriben el scraper y las acciones de admin.
 * Últimos 200, agrupados por día (UTC).
 */
export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === params.filter) ? (params.filter as Filter) : "all";
  const rows = await db.select().from(changeLog).where(whereFor(filter)).orderBy(desc(changeLog.at)).limit(200);

  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = dayLabel(r.at);
    days.set(key, [...(days.get(key) ?? []), r]);
  }

  return (
    <div>
      <h1 className="text-headline text-2xl text-ink">Activity</h1>
      <p className="text-muted-label mb-6 text-xs">Every change to the data: new results and corrections from Mana, new tournaments and ranking weeks, and what admins did. Times in UTC.</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/activity" : `/admin/activity?filter=${f.value}`}
            aria-current={f.value === filter ? "page" : undefined}
            className={`text-eyebrow rounded-full px-3 py-1.5 text-[11px] transition-colors ${
              f.value === filter ? "bg-accent-500 text-navy-900" : "border border-rule bg-paper text-muted-label hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
          Nothing recorded yet. Changes appear here from the next scraper pass and the next admin action.
        </p>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([day, items]) => (
            <section key={day}>
              <h2 className="text-eyebrow mb-2 text-[11px] text-muted-label">{day}</h2>
              <div className="overflow-hidden rounded-lg border border-rule bg-paper">
                {items.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-2.5 text-sm last:border-0">
                    <span className="tour-numeric text-muted-label w-11 shrink-0 text-xs">
                      {r.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                    </span>
                    <span
                      className={`text-eyebrow shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                        KIND_TONE[r.kind] ?? (r.source === "admin" ? "bg-accent-500/20 text-ink" : "bg-rule/60 text-muted-label")
                      }`}
                    >
                      {r.source === "admin" ? (r.actorName ?? "Admin") : (KIND_LABEL[r.kind] ?? r.kind)}
                    </span>
                    <span className="min-w-0 flex-1 text-ink">
                      {r.editionId ? (
                        <Link href={`/tournaments/${r.editionId}`} prefetch={false} className="hover:text-blue-500">
                          {r.summary}
                        </Link>
                      ) : (
                        r.summary
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
