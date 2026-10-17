import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getIsoWeek } from "@/lib/isoWeek";

/**
 * Todo lo que el resumen de /admin enseña, en UNA consulta (2026-10-17, rediseño del panel):
 * cómo va el scraper, qué hay en la cola, si rankings y torneos están al día y qué espera
 * una decisión del admin. Solo lectura.
 */
export interface AdminOverview {
  /** Última carga terminada de cada tipo (`import_runs`). */
  lastTournamentRun: Date | null;
  lastScoresRun: Date | null;
  lastRankingRun: Date | null;
  failedRuns24h: number;
  lastFailure: { at: Date; kind: string; message: string | null } | null;
  queue: { queued: number; running: number; failed24h: number };
  latestRankingWeek: { isoYear: number; isoWeek: number } | null;
  currentWeek: { isoYear: number; isoWeek: number };
  ongoingTournaments: number;
  registrationTournaments: number;
  calendarTournaments: number;
  liveMatches: number;
  liveUpdatedAt: Date | null;
  attention: {
    playerClaims: number;
    reporterRequests: number;
    newsDrafts: number;
    nameSuggestions: number;
    pendingVideos: number;
    awardSubmissions: number;
  };
}

interface Row {
  last_tournament_run: Date | string | null;
  last_scores_run: Date | string | null;
  last_ranking_run: Date | string | null;
  failed_runs_24h: number;
  last_failure_at: Date | string | null;
  last_failure_kind: string | null;
  last_failure_errors: unknown;
  queued: number;
  running: number;
  queue_failed_24h: number;
  ranking_year: number | null;
  ranking_week: number | null;
  ongoing: number;
  registration: number;
  calendar: number;
  live_matches: number | null;
  live_updated_at: Date | string | null;
  claims: number;
  reporter_requests: number;
  news_drafts: number;
  name_suggestions: number;
  pending_videos: number;
  award_submissions: number;
}

const toDate = (v: Date | string | null) => (v === null ? null : new Date(v));

function firstErrorMessage(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0] as { file?: string; message?: string };
  return [first.file, first.message].filter(Boolean).join(": ") || null;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const result = await db.execute(sql`
    WITH mana_editions AS (
      SELECT e.id, e.queue_count,
        EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id AND m.round = 'F') AS has_final,
        (EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id)
          OR EXISTS(SELECT 1 FROM byes b WHERE b.edition_id = e.id)
          OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)) AS has_draw
      FROM editions e JOIN sources s ON s.id = e.source_id
      WHERE s.slug = 'mana' AND e.year >= EXTRACT(YEAR FROM now())::int - 1
    ),
    last_failure AS (
      SELECT finished_at, kind, errors FROM import_runs WHERE status = 'failed' ORDER BY id DESC LIMIT 1
    ),
    ranking AS (
      SELECT iso_year, iso_week FROM ranking_snapshots WHERE kind = 'official' ORDER BY iso_year DESC, iso_week DESC LIMIT 1
    )
    SELECT
      (SELECT max(finished_at) FROM import_runs WHERE kind = 'tournament' AND status = 'success') AS last_tournament_run,
      (SELECT max(finished_at) FROM import_runs WHERE kind = 'scores' AND status = 'success') AS last_scores_run,
      (SELECT max(finished_at) FROM import_runs WHERE kind = 'ranking' AND status = 'success') AS last_ranking_run,
      (SELECT count(*)::int FROM import_runs WHERE status = 'failed' AND started_at > now() - interval '24 hours') AS failed_runs_24h,
      (SELECT finished_at FROM last_failure) AS last_failure_at,
      (SELECT kind FROM last_failure) AS last_failure_kind,
      (SELECT errors FROM last_failure) AS last_failure_errors,
      (SELECT count(*)::int FROM scrape_requests WHERE status = 'queued') AS queued,
      (SELECT count(*)::int FROM scrape_requests WHERE status = 'running') AS running,
      (SELECT count(*)::int FROM scrape_requests WHERE status = 'failed' AND requested_at > now() - interval '24 hours') AS queue_failed_24h,
      (SELECT iso_year FROM ranking) AS ranking_year,
      (SELECT iso_week FROM ranking) AS ranking_week,
      (SELECT count(*)::int FROM mana_editions WHERE has_draw AND NOT has_final) AS ongoing,
      (SELECT count(*)::int FROM mana_editions WHERE NOT has_draw) AS registration,
      (SELECT count(*)::int FROM calendar_tournaments) AS calendar,
      (SELECT jsonb_array_length(matches) FROM live_scores_cache WHERE id = 1) AS live_matches,
      (SELECT updated_at FROM live_scores_cache WHERE id = 1) AS live_updated_at,
      (SELECT count(*)::int FROM player_claim_requests WHERE status = 'pending') AS claims,
      (SELECT count(*)::int FROM news_reporter_requests WHERE status = 'pending') AS reporter_requests,
      (SELECT count(*)::int FROM news WHERE status = 'draft') AS news_drafts,
      (SELECT count(*)::int FROM player_name_suggestions WHERE status = 'pending') AS name_suggestions,
      (SELECT count(*)::int FROM match_videos WHERE status = 'pending') AS pending_videos,
      (SELECT count(*)::int FROM award_nominations WHERE status = 'pending') AS award_submissions
  `);
  const r = ((Array.isArray(result) ? result : result.rows) as Row[])[0];

  return {
    lastTournamentRun: toDate(r.last_tournament_run),
    lastScoresRun: toDate(r.last_scores_run),
    lastRankingRun: toDate(r.last_ranking_run),
    failedRuns24h: Number(r.failed_runs_24h),
    lastFailure: r.last_failure_at
      ? { at: new Date(r.last_failure_at), kind: r.last_failure_kind ?? "", message: firstErrorMessage(r.last_failure_errors) }
      : null,
    queue: { queued: Number(r.queued), running: Number(r.running), failed24h: Number(r.queue_failed_24h) },
    latestRankingWeek: r.ranking_year === null || r.ranking_week === null ? null : { isoYear: Number(r.ranking_year), isoWeek: Number(r.ranking_week) },
    currentWeek: getIsoWeek(new Date()),
    ongoingTournaments: Number(r.ongoing),
    registrationTournaments: Number(r.registration),
    calendarTournaments: Number(r.calendar),
    liveMatches: Number(r.live_matches ?? 0),
    liveUpdatedAt: toDate(r.live_updated_at),
    attention: {
      playerClaims: Number(r.claims),
      reporterRequests: Number(r.reporter_requests),
      newsDrafts: Number(r.news_drafts),
      nameSuggestions: Number(r.name_suggestions),
      pendingVideos: Number(r.pending_videos),
      awardSubmissions: Number(r.award_submissions),
    },
  };
}

export interface AdminTournamentRow {
  editionId: number;
  externalId: string;
  eventName: string;
  category: string;
  isoWeek: number | null;
  status: "registration" | "ongoing";
  queueCount: number | null;
  queueCapacity: number | null;
  matches: number;
  pendingSlots: number;
  refreshedAt: Date | null;
}

/** Torneos de Mana todavía abiertos (en inscripción o en juego), con su última recarga. */
export async function getOpenTournamentsForAdmin(): Promise<AdminTournamentRow[]> {
  const result = await db.execute(sql`
    SELECT e.id AS edition_id, e.external_id, ev.display_name AS event_name, e.category, e.iso_week,
      e.queue_count, e.queue_capacity, e.refreshed_at,
      (SELECT count(*)::int FROM matches m WHERE m.edition_id = e.id) AS matches,
      (SELECT count(*)::int FROM pending_slots ps WHERE ps.edition_id = e.id) AS pending_slots,
      (EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes b WHERE b.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)) AS has_draw
    FROM editions e
    JOIN events ev ON ev.id = e.event_id
    JOIN sources s ON s.id = e.source_id
    WHERE s.slug = 'mana'
      AND NOT EXISTS (SELECT 1 FROM matches mf WHERE mf.edition_id = e.id AND mf.round = 'F')
    ORDER BY e.iso_week DESC NULLS LAST, e.id DESC
  `);
  const rows = (Array.isArray(result) ? result : result.rows) as {
    edition_id: number;
    external_id: string;
    event_name: string;
    category: string;
    iso_week: number | null;
    queue_count: number | null;
    queue_capacity: number | null;
    refreshed_at: Date | string | null;
    matches: number;
    pending_slots: number;
    has_draw: boolean;
  }[];
  return rows.map((r) => ({
    editionId: Number(r.edition_id),
    externalId: r.external_id,
    eventName: r.event_name,
    category: r.category,
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    status: r.has_draw ? "ongoing" : "registration",
    queueCount: r.queue_count === null ? null : Number(r.queue_count),
    queueCapacity: r.queue_capacity === null ? null : Number(r.queue_capacity),
    matches: Number(r.matches),
    pendingSlots: Number(r.pending_slots),
    refreshedAt: toDate(r.refreshed_at),
  }));
}

/** Minutos desde una fecha (`Infinity` si no hay) — fuera de los componentes: la hora actual
 * no se lee durante el render (regla react-hooks/purity). */
export function minutesSince(date: Date | null): number {
  return date ? (Date.now() - date.getTime()) / 60_000 : Infinity;
}

/** "5 min ago", "3 h ago"... */
export function timeAgo(date: Date | null): string {
  const min = Math.round(minutesSince(date));
  if (!Number.isFinite(min)) return "never";
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
