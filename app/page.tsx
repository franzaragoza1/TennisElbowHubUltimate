import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { NewsRail } from "@/components/news/NewsRail";
import { CommunityLinks } from "@/components/home/CommunityLinks";
import { LiveScoresStrip } from "@/components/scores/LiveScoresStrip";
import { TournamentScoresBlock } from "@/components/scores/TournamentScoresBlock";
import { getPublishedNews } from "@/lib/newsQueries";
import { getRecentScoresByCircuit } from "@/lib/scoresQueries";
import {
  getLatestRankingWeek,
  getRecentTournaments,
  getTopPlayers,
} from "@/lib/tourQueries";

export const revalidate = 3600;

function SectionHeading({
  title,
  href,
  linkLabel,
  dark = false,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  dark?: boolean;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className={`text-headline text-xl sm:text-2xl ${dark ? "text-white" : "text-ink"}`}>
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className={`text-eyebrow shrink-0 text-xs hover:underline ${
            dark ? "text-accent-500" : "text-blue-500"
          }`}
        >
          {linkLabel ?? "View all"}
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const week = await getLatestRankingWeek();

  if (!week) {
    return (
      <div className="tour-container py-16">
        <p className="text-muted-label">No ranking data loaded yet.</p>
      </div>
    );
  }

  const [top, tournaments, stories, scoreBlocks] = await Promise.all([
    getTopPlayers(week, 10),
    getRecentTournaments(6),
    getPublishedNews(10),
    getRecentScoresByCircuit("tour"),
  ]);
  const latestScoreBlock = scoreBlocks[0];

  const number1 = top[0];
  const number2 = top[1];

  return (
    <div>
      {/* La banda de marca en tamaño hero la pone SiteNav al detectar la home. */}

      {/* Nº1 de la semana */}
      {number1 && (
        <section className="bg-navy-900">
          <div className="tour-container flex flex-col gap-8 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-14">
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-5 duration-700">
              <PlayerAvatar
                displayName={number1.displayName}
                country={number1.country}
                character={number1.character}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-eyebrow text-xs text-accent-500">
                  World No. 1 · {week.isoYear} Week {week.isoWeek}
                </p>
                <Link
                  href={`/players/${number1.playerId}`}
                  className="text-headline block truncate text-3xl text-white hover:underline sm:text-5xl"
                >
                  {number1.displayName}
                </Link>
                <p className="tour-numeric mt-1 text-sm text-white/60">
                  {number1.points.toLocaleString("en-US")} pts
                </p>
              </div>
            </div>

            <div className="animate-in fade-in slide-in-from-right-2 flex shrink-0 gap-3 duration-700">
              <Link
                href="/rankings"
                className="tap-scale text-eyebrow rounded-full bg-accent-500 px-6 py-3 text-xs text-navy-900 transition hover:scale-105 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Full rankings
              </Link>
              {number2 && (
                <Link
                  href={`/h2h/${number1.playerId}/${number2.playerId}`}
                  className="tap-scale text-eyebrow rounded-full border border-white/30 px-6 py-3 text-xs text-white transition hover:scale-105 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  No. 1 vs No. 2
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <LiveScoresStrip />

      <NewsRail items={stories} />

      {/* Últimos resultados — un solo bloque (el torneo más reciente con actividad),
       * el resto vive en /scores. Si no hay nada reportado todavía, la sección entera
       * se omite en vez de enseñar una tarjeta vacía. */}
      {latestScoreBlock && (
        <section className="tour-container pt-12">
          <SectionHeading title="Recent scores" href="/scores" />
          <div className="pt-5">
            <TournamentScoresBlock block={latestScoreBlock} />
          </div>
        </section>
      )}

      {/* Últimos torneos */}
      <section className="tour-container py-12">
        <SectionHeading title="Latest tournaments" href="/tournaments" />
        {/* flex-wrap, no grid: TournamentCard ensancha para un nombre de campeón largo
         * en vez de partirlo en varias líneas (ver lib/tournamentTier.ts y
         * app/tournaments/page.tsx, mismo patrón) — en un grid de columnas fijas esa
         * tarjeta se saldría de su celda. */}
        <div className="flex flex-wrap items-start gap-4 pt-5">
          {tournaments.map((t) => (
            <TournamentCard key={t.editionId} data={t} />
          ))}
        </div>
      </section>

      {/* Top 10 */}
      <section className="tour-container pb-14">
        <SectionHeading title="Top 10" href="/rankings" linkLabel="Full rankings" />
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {top.map((p, i) => (
            <Link
              key={p.playerId}
              href={`/players/${p.playerId}`}
              className="row-reveal flex items-center gap-4 border-b border-rule px-4 py-3 transition-colors last:border-0 hover:bg-paper-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
              style={{ "--reveal-delay": `${i * 30}ms` } as React.CSSProperties}
            >
              <span className="tour-numeric text-headline w-6 shrink-0 text-right text-ink">
                {p.rank}
              </span>
              <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
                <CountryFlag country={p.country} className="h-full w-full object-cover" />
              </span>
              <span className="text-headline min-w-0 flex-1 truncate text-ink">
                {p.displayName}
              </span>
              <span className="tour-numeric text-headline shrink-0 text-ink">
                {p.points.toLocaleString("en-US")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Comunidad y recursos */}
      <section className="tour-container pb-14">
        <SectionHeading title="Community &amp; resources" />
        <CommunityLinks />
      </section>
    </div>
  );
}
