import Link from "next/link";
import { getAdminOverview, getOpenTournamentsForAdmin, minutesSince, timeAgo as ago } from "@/lib/adminDashboard";

type Tone = "ok" | "warn" | "bad";
const TONE: Record<Tone, string> = { ok: "bg-up", warn: "bg-amber-500", bad: "bg-down" };

/** Un recuadro de estado: punto de color + valor + detalle. */
function Status({ label, value, detail, tone, href }: { label: string; value: string; detail?: string; tone: Tone; href?: string }) {
  const body = (
    <>
      <p className="text-eyebrow flex items-center gap-2 text-[10px] text-muted-label">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[tone]}`} aria-hidden="true" />
        {label}
      </p>
      <p className="text-headline mt-2 text-lg text-ink">{value}</p>
      {detail && <p className="text-muted-label mt-0.5 text-xs">{detail}</p>}
    </>
  );
  const cls = "block rounded-lg border border-rule bg-paper p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-blue-500`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Resumen del panel de admin (2026-10-17): de un vistazo, si el scraper funciona, si los
 * datos están al día y qué espera una decisión. Cada recuadro lleva a su sección.
 */
export default async function AdminOverviewPage() {
  const [o, open] = await Promise.all([getAdminOverview(), getOpenTournamentsForAdmin()]);

  // El scraper pasa cada 10 min; dos pasadas sin noticias ya es raro, una hora es un problema.
  const scraperTone: Tone = minutesSince(o.lastTournamentRun) < 25 ? "ok" : minutesSince(o.lastTournamentRun) < 60 ? "warn" : "bad";
  const rankingBehind = o.latestRankingWeek
    ? (o.currentWeek.isoYear - o.latestRankingWeek.isoYear) * 52 + (o.currentWeek.isoWeek - o.latestRankingWeek.isoWeek)
    : Infinity;
  const stale = open.filter((t) => minutesSince(t.refreshedAt) > 30);
  const attention = [
    { label: "Player claims", count: o.attention.playerClaims, href: "/admin/players" },
    { label: "News drafts", count: o.attention.newsDrafts, href: "/admin/news" },
    { label: "Reporter requests", count: o.attention.reporterRequests, href: "/admin/news" },
    { label: "Name suggestions", count: o.attention.nameSuggestions, href: "/admin/match-log" },
    { label: "Videos to review", count: o.attention.pendingVideos, href: "/admin/videos" },
    { label: "Award submissions", count: o.attention.awardSubmissions, href: "/admin/awards" },
  ].filter((x) => x.count > 0);

  return (
    <div>
      <h1 className="text-headline text-2xl text-ink">Overview</h1>
      <p className="text-muted-label mb-6 text-xs">What the scraper did, whether the data is up to date, and what is waiting for you.</p>

      <h2 className="text-eyebrow mb-3 text-[11px] text-muted-label">Data</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Status
          label="Scraper"
          tone={scraperTone}
          value={`Last pass ${ago(o.lastTournamentRun)}`}
          detail={o.failedRuns24h > 0 ? `${o.failedRuns24h} failed load${o.failedRuns24h === 1 ? "" : "s"} in 24 h` : "No failures in 24 h"}
        />
        <Status
          label="Tournaments"
          tone={stale.length > 0 ? "warn" : "ok"}
          value={`${o.ongoingTournaments} ongoing · ${o.registrationTournaments} open`}
          detail={
            stale.length > 0
              ? `${stale.length} not refreshed for 30+ min`
              : o.calendarTournaments > 0
                ? `${o.calendarTournaments} more announced on the calendar`
                : "All refreshed"
          }
          href="/admin/tournaments"
        />
        <Status
          label="Rankings"
          tone={rankingBehind <= 1 ? "ok" : "warn"}
          value={o.latestRankingWeek ? `Week ${o.latestRankingWeek.isoWeek}, ${o.latestRankingWeek.isoYear}` : "Nothing imported"}
          detail={`Checked ${ago(o.lastRankingRun)} · now week ${o.currentWeek.isoWeek}`}
          href="/admin/rankings"
        />
        <Status
          label="Live scores"
          tone={minutesSince(o.liveUpdatedAt) < 2 ? "ok" : "bad"}
          value={o.liveMatches === 0 ? "No live matches" : `${o.liveMatches} live`}
          detail={`Updated ${ago(o.liveUpdatedAt)}`}
          href="/admin/scores"
        />
      </div>

      {(o.queue.queued > 0 || o.queue.running > 0 || o.queue.failed24h > 0 || o.lastFailure) && (
        <div className="mt-3 rounded-lg border border-rule bg-paper px-4 py-3 text-xs">
          {(o.queue.queued > 0 || o.queue.running > 0) && (
            <p className="text-ink">
              Queue: {o.queue.running} running, {o.queue.queued} waiting
            </p>
          )}
          {o.queue.failed24h > 0 && <p className="text-down">{o.queue.failed24h} queued request(s) failed in the last 24 h</p>}
          {o.lastFailure && (
            <p className="text-muted-label">
              Last failed load ({o.lastFailure.kind}, {ago(o.lastFailure.at)}){o.lastFailure.message ? `: ${o.lastFailure.message}` : ""}
            </p>
          )}
        </div>
      )}

      <h2 className="text-eyebrow mt-8 mb-3 text-[11px] text-muted-label">Waiting for you</h2>
      {attention.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-6 text-center text-sm">Nothing to review.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {attention.map((x) => (
            <Link
              key={x.label}
              href={x.href}
              className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm transition-colors last:border-0 hover:bg-paper-tint"
            >
              <span className="text-ink">{x.label}</span>
              <span className="tour-numeric rounded-full bg-accent-500 px-2 text-xs leading-5 font-bold text-navy-900">{x.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
