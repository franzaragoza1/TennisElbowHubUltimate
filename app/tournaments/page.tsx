import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { TournamentCard, type TournamentCardData } from "@/components/tournaments/TournamentCard";
import { SeasonTabs } from "@/components/tournaments/SeasonTabs";
import { finalsEditionToTournamentCard } from "@/components/finals/FinalsEditionCard";
import { getSeasons, getTournamentsByYear } from "@/lib/tourQueries";
import { listFinalsEditions } from "@/lib/finals/queries";
import { TIER_WEIGHT, tournamentTier } from "@/lib/tournamentTier";
import { AutoRefresh } from "@/components/layout/AutoRefresh";

// 10 min, no 1h: con algo en juego (ver AutoRefresh más abajo) una visita fresca no
// puede traer datos de hace una hora entera.
export const revalidate = 600;

/** Desempate DENTRO de la tarjeta "small" (CT 80/90/100/125, Future, Exhibition,
 * cualquier categoría sin clasificar): un Challenger sigue siendo más importante que
 * un Future aunque `tournamentTier` los junte en el mismo tamaño de tarjeta visual
 * (pedido explícito) — sin tocar `lib/tournamentTier.ts`, que decide tamaño de
 * tarjeta, no orden fino dentro del tamaño más pequeño. */
function smallTierWeight(category: string): number {
  return category.startsWith("CT ") ? 1 : 0;
}

/** Agrupa por semana ISO (ya vienen ordenadas semana DESC desde `getTournamentsByYear`,
 * así que un Map basta para conservar ese orden) y, dentro de cada semana, ordena de
 * mayor a menor peso — así el torneo más importante de la semana queda el primero en
 * el flujo, es decir, el de más a la izquierda (pedido explícito). */
function groupByWeek(tournaments: TournamentCardData[]): [number | null, TournamentCardData[]][] {
  const weeks = new Map<number | null, TournamentCardData[]>();
  for (const t of tournaments) {
    if (!weeks.has(t.isoWeek)) weeks.set(t.isoWeek, []);
    weeks.get(t.isoWeek)!.push(t);
  }
  for (const group of weeks.values()) {
    group.sort((a, b) => {
      const tierDiff = TIER_WEIGHT[tournamentTier(b.category)] - TIER_WEIGHT[tournamentTier(a.category)];
      if (tierDiff !== 0) return tierDiff;
      return smallTierWeight(b.category) - smallTierWeight(a.category);
    });
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
  const [tournaments, allFinals] = await Promise.all([getTournamentsByYear(year), listFinalsEditions()]);
  const weeks = groupByWeek(tournaments);
  // Se enseñan aparte del reparto por semana (Finals no tiene `isoWeek` real, y
  // agruparla bajo "Date unknown" junto a torneos con datos incompletos sería
  // engañoso — esto es el cierre de temporada, no un hueco en los datos).
  const finalsThisYear = allFinals.filter((f) => f.year === year);
  // Solo si algo de lo que se ve ahora mismo sigue en juego — una temporada pasada
  // entera no va a cambiar, refrescarla cada 10 min sería tráfico sin ningún dato
  // nuevo que traer (pedido explícito del propietario).
  const hasOngoing = tournaments.some((t) => t.status === "ongoing");

  return (
    <div>
      {hasOngoing && <AutoRefresh />}
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Tournaments"
        subtitle={`${tournaments.length + finalsThisYear.length} tournaments in the ${year} season`}
      >
        <SeasonTabs seasons={seasons} current={year} />
      </PageMasthead>

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
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

          {finalsThisYear.length > 0 && (
            <section className="mb-10">
              <h2 className="text-eyebrow mb-3 text-xs text-muted-label">Season Finale</h2>
              <div className="flex flex-wrap items-start gap-4 pt-5">
                {finalsThisYear.map((f) => (
                  <TournamentCard key={`finals-${f.id}`} data={finalsEditionToTournamentCard(f)} tier="large" href={`/finals/${f.id}`} />
                ))}
              </div>
            </section>
          )}

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
        <Sidebar />
      </div>
    </div>
  );
}
