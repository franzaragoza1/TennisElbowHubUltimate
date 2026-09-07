import type { MyRecentStats } from "@/lib/statsQueries";

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <p className="text-eyebrow text-[10px] text-muted-label">{label}</p>
      <p className="tour-numeric text-headline mt-1 text-2xl text-ink">
        {value}
        {unit && <span className="text-muted-label ml-1 text-sm font-normal">{unit}</span>}
      </p>
    </div>
  );
}

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

function num(v: number | null): string {
  return v === null ? "—" : String(v);
}

/**
 * "My Stats" en /account — pedido explícito: "breaking down all your recent matches
 * statistics from match log or not (NOT match history, but the most important
 * matches statistics)". El récord W/L sale de partidos reales aunque nunca se haya
 * subido un MatchLog; las columnas de saque/resto solo existen para los partidos de
 * la ventana que sí tienen estadística real subida (lib/statsQueries.ts::
 * getMyRecentStats) — si no hay ninguno, se enseña un aviso en vez de casillas
 * vacías o inventadas.
 */
export function MyStatsCard({ stats }: { stats: MyRecentStats }) {
  const played = stats.wins + stats.losses;
  const winPct = played > 0 ? Math.round((stats.wins / played) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-label text-sm">Last {stats.windowDays} days.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Record" value={`${stats.wins}-${stats.losses}`} />
        <StatTile label="Win %" value={winPct === null ? "—" : String(winPct)} unit={winPct === null ? undefined : "%"} />
        <StatTile label="Matches played" value={String(stats.matchesPlayed)} />
      </div>

      {stats.matchesWithStats === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper-tint px-4 py-6 text-center text-sm">
          No MatchLog stats uploaded in this window yet — upload one to see your serve and return numbers here.
        </p>
      ) : (
        <>
          <p className="text-eyebrow text-[10px] text-muted-label">
            From {stats.matchesWithStats} match{stats.matchesWithStats === 1 ? "" : "es"} with a MatchLog uploaded
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="1st serve %" value={pct(stats.firstServePct)} />
            <StatTile label="1st serve won %" value={pct(stats.firstServeWonPct)} />
            <StatTile label="2nd serve won %" value={pct(stats.secondServeWonPct)} />
            <StatTile label="Return points won %" value={pct(stats.returnPointsWonPct)} />
            <StatTile label="Break points won %" value={pct(stats.breakPointsWonPct)} />
            <StatTile label="Aces/match" value={num(stats.acesPerMatch)} />
            <StatTile label="Double faults/match" value={num(stats.doubleFaultsPerMatch)} />
            <StatTile label="Fastest serve" value={num(stats.fastestServeKmh)} unit={stats.fastestServeKmh === null ? undefined : "km/h"} />
          </div>
        </>
      )}
    </div>
  );
}
