import { PageMasthead } from "@/components/layout/PageMasthead";
import { TournamentCard, type TournamentCardData } from "@/components/tournaments/TournamentCard";
import { SeasonTabs } from "@/components/tournaments/SeasonTabs";
import { getSeasons, getTournamentsByYear } from "@/lib/tourQueries";
import { TIER_WEIGHT, tournamentTier } from "@/lib/tournamentTier";

export const revalidate = 3600;

/** Agrupa por semana ISO (ya vienen ordenadas semana DESC desde `getTournamentsByYear`,
 * así que un Map basta para conservar ese orden) y, dentro de cada semana, ordena de
 * menor a mayor peso — así el torneo más importante de la semana queda el último en el
 * flujo, es decir, el de más a la derecha. */
function groupByWeek(tournaments: TournamentCardData[]): [number | null, TournamentCardData[]][] {
  const weeks = new Map<number | null, TournamentCardData[]>();
  for (const t of tournaments) {
    if (!weeks.has(t.isoWeek)) weeks.set(t.isoWeek, []);
    weeks.get(t.isoWeek)!.push(t);
  }
  for (const group of weeks.values()) {
    group.sort((a, b) => TIER_WEIGHT[tournamentTier(a.category)] - TIER_WEIGHT[tournamentTier(b.category)]);
  }
  return [...weeks.entries()];
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const [params, seasons] = await Promise.all([searchParams, getSeasons()]);

  if (seasons.length === 0) {
    return (
      <div className="tour-container py-16">
        <p className="text-muted-label">No tournaments loaded yet.</p>
      </div>
    );
  }

  const requested = Number(params.year);
  const year = seasons.includes(requested) ? requested : seasons[0];
  const tournaments = await getTournamentsByYear(year);
  const weeks = groupByWeek(tournaments);

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Tournaments"
        subtitle={`${tournaments.length} tournaments in the ${year} season`}
      >
        <SeasonTabs seasons={seasons} current={year} />
      </PageMasthead>

      <div className="tour-container py-8">
        <a
          href="https://tenniselbowhub.live/guides/how-to-play-online-matches-the-official-tour-xkt"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-paper-tint px-5 py-4 transition-colors hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <span className="text-sm text-ink">
            <span className="text-headline">First time competing?</span> Follow our guide.
          </span>
          <span className="text-eyebrow shrink-0 text-xs text-blue-500">Read the guide →</span>
        </a>

        <div className="space-y-10">
          {weeks.map(([isoWeek, weekTournaments]) => (
            <section key={isoWeek ?? "none"}>
              <h2 className="text-eyebrow mb-3 text-xs text-muted-label">
                {isoWeek ? `Week ${isoWeek}` : "Date unknown"}
              </h2>
              {/* Espacio de sobra encima de la fila: la tarjeta crece y sube al pasar el
               * ratón (`hover:scale-110 hover:-translate-y-2` en TournamentCard) — sin
               * este margen, la ronda encabezado "Week N" quedaba tapada por la tarjeta
               * en pleno hover. */}
              <div className="flex flex-wrap items-start gap-4 pt-5">
                {weekTournaments.map((t) => (
                  <TournamentCard key={t.editionId} data={t} tier={tournamentTier(t.category)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
