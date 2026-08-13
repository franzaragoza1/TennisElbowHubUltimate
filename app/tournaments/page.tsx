import { PageMasthead } from "@/components/layout/PageMasthead";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { SeasonTabs } from "@/components/tournaments/SeasonTabs";
import { getSeasons, getTournamentsByYear } from "@/lib/tourQueries";

export const revalidate = 3600;

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.editionId} data={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
