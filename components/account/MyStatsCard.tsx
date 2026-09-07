"use client";

import { useState, useTransition } from "react";
import { fetchMyRecentStats } from "@/app/account/actions";
import type { MyRecentStats } from "@/lib/statsQueries";
import { MY_STATS_WINDOWS, type MyStatsWindow } from "@/lib/myStatsWindow";
import { MY_STATS_RANGES, statColor, type StatRange } from "@/lib/statColorScale";

function StatTile({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <p className="text-eyebrow text-[10px] text-muted-label">{label}</p>
      <p className="tour-numeric text-headline mt-1 text-2xl" style={{ color: color ?? "var(--ink)" }}>
        {value}
        {unit && <span className="text-muted-label ml-1 text-sm font-normal">{unit}</span>}
      </p>
    </div>
  );
}

/** "Record" no es un único número que colorear de rojo a verde (StatTile) — son dos
 * mitades con sentido opuesto, así que cada una lleva el color fijo de subida/bajada
 * (--up/--down, mismos tokens que el resto del sitio) en vez de una interpolación. */
function RecordTile({ wins, losses }: { wins: number; losses: number }) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <p className="text-eyebrow text-[10px] text-muted-label">Record</p>
      <p className="tour-numeric text-headline mt-1 text-2xl text-ink">
        <span style={{ color: "var(--up)" }}>{wins}</span>
        {"-"}
        <span style={{ color: "var(--down)" }}>{losses}</span>
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

/** Color de un tile a partir de su valor y su rango calibrado (lib/statColorScale.ts)
 * — `undefined` deja el tile en el color de texto normal (dato ausente). */
function tileColor(value: number | null, range: StatRange): string | undefined {
  return statColor(value, range);
}

const WINDOW_LABELS: Record<MyStatsWindow, string> = {
  30: "Last 30 days",
  90: "Last 90 days",
  180: "Last 180 days",
  365: "Last 365 days",
  career: "Career",
};

/**
 * "My Stats" en /account — pedido explícito: "breaking down all your recent matches
 * statistics from match log or not (NOT match history, but the most important
 * matches statistics)". El récord W/L sale de partidos reales aunque nunca se haya
 * subido un MatchLog; las columnas de saque/resto solo existen para los partidos de
 * la ventana que sí tienen estadística real subida (lib/statsQueries.ts::
 * getMyRecentStats) — si no hay ninguno, se enseña un aviso en vez de casillas
 * vacías o inventadas.
 *
 * Cliente, no servidor: el periodo es elegible (pedido explícito) y cambiarlo pide un
 * resumen nuevo vía Server Action en vez de navegar — `stats` de la prop es solo el
 * primer render (periodo por defecto, calculado en app/account/page.tsx).
 */
export function MyStatsCard({ stats: initialStats }: { stats: MyRecentStats }) {
  const [stats, setStats] = useState(initialStats);
  const [isPending, startTransition] = useTransition();

  function handleWindowChange(window: MyStatsWindow) {
    if (window === stats.window) return;
    startTransition(async () => {
      const next = await fetchMyRecentStats(String(window));
      if (next) setStats(next);
    });
  }

  const played = stats.wins + stats.losses;
  const winPct = played > 0 ? Math.round((stats.wins / played) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-label text-sm">{WINDOW_LABELS[stats.window]}.</p>
        <div className="flex flex-wrap gap-1.5">
          {MY_STATS_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => handleWindowChange(w)}
              disabled={isPending}
              className={`text-eyebrow rounded-full border px-3 py-1 text-[10px] transition-colors disabled:cursor-wait ${
                w === stats.window
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-rule text-muted-label hover:border-blue-500 hover:text-blue-500"
              }`}
            >
              {w === "career" ? "Career" : `${w}d`}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
        <RecordTile wins={stats.wins} losses={stats.losses} />
        <StatTile
          label="Win %"
          value={winPct === null ? "—" : String(winPct)}
          unit={winPct === null ? undefined : "%"}
          color={tileColor(winPct, MY_STATS_RANGES.winPct)}
        />
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
          <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
            <StatTile label="1st serve %" value={pct(stats.firstServePct)} color={tileColor(stats.firstServePct, MY_STATS_RANGES.firstServePct)} />
            <StatTile
              label="1st serve won %"
              value={pct(stats.firstServeWonPct)}
              color={tileColor(stats.firstServeWonPct, MY_STATS_RANGES.firstServeWonPct)}
            />
            <StatTile
              label="2nd serve won %"
              value={pct(stats.secondServeWonPct)}
              color={tileColor(stats.secondServeWonPct, MY_STATS_RANGES.secondServeWonPct)}
            />
            <StatTile
              label="Return points won %"
              value={pct(stats.returnPointsWonPct)}
              color={tileColor(stats.returnPointsWonPct, MY_STATS_RANGES.returnPointsWonPct)}
            />
            <StatTile
              label="Break points won %"
              value={pct(stats.breakPointsWonPct)}
              color={tileColor(stats.breakPointsWonPct, MY_STATS_RANGES.breakPointsWonPct)}
            />
            <StatTile label="Aces/match" value={num(stats.acesPerMatch)} color={tileColor(stats.acesPerMatch, MY_STATS_RANGES.acesPerMatch)} />
            <StatTile
              label="Double faults/match"
              value={num(stats.doubleFaultsPerMatch)}
              color={tileColor(stats.doubleFaultsPerMatch, MY_STATS_RANGES.doubleFaultsPerMatch)}
            />
            <StatTile
              label="Fastest serve"
              value={num(stats.fastestServeKmh)}
              unit={stats.fastestServeKmh === null ? undefined : "km/h"}
              color={tileColor(stats.fastestServeKmh, MY_STATS_RANGES.fastestServeKmh)}
            />
          </div>
        </>
      )}
    </div>
  );
}
