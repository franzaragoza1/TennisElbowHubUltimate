import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import type { StatShowcaseRow } from "@/lib/statsQueries";
import { STAT_GROUPS, type StatGroup } from "@/lib/statGroups";

/**
 * Escaparate de las cuatro categorías (la portada de /stats y la home). Rediseño
 * 2026-10-17: cada tarjeta dice qué mide y qué es la cifra de debajo del nombre (antes un
 * número suelto, "201.2", sin ninguna etiqueta), el primero en grande y los demás en
 * filas con barra proporcional a la cifra, y la tarjeta entera lleva al detalle.
 * Cuatro columnas en escritorio, dos en tableta, una en móvil.
 */
function StatCard({
  group,
  rows,
}: {
  group: StatGroup;
  rows: StatShowcaseRow[];
}) {
  const info = STAT_GROUPS.find((g) => g.value === group)!;
  const leader = rows[0];
  const rest = rows.slice(1);
  const unit = group === "shotmaking" ? "%" : "";
  const fmt = (n: number) => `${n.toFixed(1)}${unit}`;
  const max = Math.max(...rows.map((r) => r.rating), 0);
  const min = Math.min(...rows.map((r) => r.rating), max);
  // Barra de cada fila: de un 35 % (el último) a un 100 % (el primero) — nunca una barra
  // vacía, que se leería como "cero", y siempre visible la diferencia entre ellos.
  const bar = (v: number) => (max === min ? 100 : 35 + (65 * (v - min)) / (max - min));

  return (
    <section aria-labelledby={`stat-card-${group}`} className="flex min-w-0 flex-col rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <h3 id={`stat-card-${group}`} className="text-headline text-lg text-white">
        {info.label}
      </h3>
      <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-white/60">{info.blurb}</p>

      {leader ? (
        <>
          <Link
            href={`/players/${leader.playerId}`}
            prefetch={false}
            className="group mt-4 flex items-center gap-3 rounded-lg bg-white/[0.06] p-3 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <PlayerAvatar displayName={leader.displayName} country={leader.country} avatarUrl={leader.avatarUrl} size="md" onDarkSurface />
            <span className="min-w-0 flex-1">
              <span className="text-eyebrow block text-[10px] text-accent-500">No. 1</span>
              <span className="text-headline block text-base leading-tight break-words text-white group-hover:underline">{leader.displayName}</span>
              <span className="tour-numeric text-headline block text-2xl text-white">{fmt(leader.rating)}</span>
              <span className="text-eyebrow block text-[10px] text-white/50">{info.ratingLabel}</span>
            </span>
          </Link>

          <ol start={2} className="mt-3 flex flex-col">
            {rest.map((row, i) => (
              <li key={row.playerId} className="border-t border-white/10 first:border-t-0">
                <Link
                  href={`/players/${row.playerId}`}
                  prefetch={false}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
                >
                  <span className="tour-numeric w-4 shrink-0 text-sm text-white/60">{i + 2}</span>
                  <PlayerAvatar displayName={row.displayName} country={row.country} avatarUrl={row.avatarUrl} size="xs" onDarkSurface />
                  <span className="min-w-0 flex-1">
                    <span className="text-headline block text-sm leading-tight break-words text-white">{row.displayName}</span>
                    <span className="mt-1 block h-1 rounded-full bg-white/10" aria-hidden="true">
                      <span className="block h-1 rounded-full bg-accent-500/70" style={{ width: `${bar(row.rating)}%` }} />
                    </span>
                  </span>
                  <span className="tour-numeric w-14 shrink-0 text-right text-sm text-white/80">{fmt(row.rating)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="text-eyebrow flex-1 py-10 text-center text-xs text-white/40">Not enough data yet</p>
      )}

      <div className="mt-auto pt-4">
        <Link
          href={`/stats?group=${group}`}
          className="tap-scale text-eyebrow flex items-center justify-center gap-1.5 rounded-full border border-white/30 px-4 py-2.5 text-xs text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          View full table <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

export function StatsLeadersShowcase({
  serve,
  returnLeaders,
  pressure,
  shotmaking = [],
}: {
  serve: StatShowcaseRow[];
  returnLeaders: StatShowcaseRow[];
  pressure: StatShowcaseRow[];
  shotmaking?: StatShowcaseRow[];
}) {
  return (
    <div className="rounded-lg bg-navy-900 p-5 sm:p-8">
      <h2 className="text-headline text-xl text-white sm:text-2xl">Stats leaderboards</h2>
      <p className="mt-1 mb-6 text-sm text-white/60">Last 52 weeks · ratings adjusted for matches played · at least 5 matches with recorded stats.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard group="serve" rows={serve} />
        <StatCard group="return" rows={returnLeaders} />
        <StatCard group="pressure" rows={pressure} />
        <StatCard group="shotmaking" rows={shotmaking} />
      </div>
    </div>
  );
}
