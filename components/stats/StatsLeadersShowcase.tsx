import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import type { StatShowcaseRow } from "@/lib/statsQueries";

/**
 * Escaparate de portada al estilo "Infosys ATP Stats Leaderboards" — MISMA
 * estructura (tres columnas, Nº1 destacado, 2-5 en fila compacta, botón "View all"),
 * pero con nuestra propia cabecera y paleta (navy/lima ya establecida en
 * CLAUDE.md §6), nunca el logotipo ni el lockup de patrocinador de la ATP/Infosys —
 * eso es lo único de la referencia que no se replica (CLAUDE.md §6, "Límite: marcas y
 * fotos").
 */
function StatColumn({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: StatShowcaseRow[];
}) {
  const leader = rows[0];
  const rest = rows.slice(1);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="text-eyebrow mb-4 rounded-md bg-accent-500 px-3 py-2 text-center text-xs text-navy-900">
        {title}
      </div>

      {leader ? (
        <>
          <Link href={`/players/${leader.playerId}`} className="group flex flex-col items-center gap-2 pb-4 hover:opacity-90">
            <span className="tour-numeric self-start text-sm text-white/60">1</span>
            <PlayerAvatar
              displayName={leader.displayName}
              country={leader.country}
              character={leader.character}
              avatarUrl={leader.avatarUrl}
              size="lg"
            />
            <span className="text-headline rounded-md bg-white px-3 py-1 text-sm text-navy-900 group-hover:underline">
              {leader.displayName}
            </span>
            <span className="tour-numeric text-headline text-2xl text-white">{leader.rating.toFixed(1)}</span>
          </Link>

          <div className="flex flex-col">
            {rest.map((row, i) => (
              <Link
                key={row.playerId}
                href={`/players/${row.playerId}`}
                className="flex items-center gap-3 border-t border-white/10 py-3 hover:bg-white/5"
              >
                <span className="tour-numeric w-4 shrink-0 text-sm text-white/60">{i + 2}</span>
                <PlayerAvatar
                  displayName={row.displayName}
                  country={row.country}
                  character={row.character}
                  avatarUrl={row.avatarUrl}
                />
                <span className="text-headline min-w-0 flex-1 truncate text-sm text-white">{row.displayName}</span>
                <span className="tour-numeric shrink-0 text-sm text-white/80">{row.rating.toFixed(1)}</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="text-eyebrow flex-1 py-10 text-center text-xs text-white/40">Not enough data yet</p>
      )}

      <Link
        href={href}
        className="tap-scale text-eyebrow mt-4 flex items-center justify-center gap-1.5 rounded-full border border-white/30 px-4 py-2.5 text-xs text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        View all {title} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function StatsLeadersShowcase({
  serve,
  returnLeaders,
  pressure,
}: {
  serve: StatShowcaseRow[];
  returnLeaders: StatShowcaseRow[];
  pressure: StatShowcaseRow[];
}) {
  return (
    <div className="rounded-lg bg-navy-900 p-6 sm:p-8">
      <h2 className="text-headline mb-6 text-center text-xl text-white sm:text-2xl">Stats Leaderboards</h2>
      <div className="flex flex-col gap-8 sm:flex-row sm:gap-6">
        <StatColumn title="Serve Leaders" href="/stats?group=serve" rows={serve} />
        <StatColumn title="Return Leaders" href="/stats?group=return" rows={returnLeaders} />
        <StatColumn title="Pressure Leaders" href="/stats?group=pressure" rows={pressure} />
      </div>
    </div>
  );
}
