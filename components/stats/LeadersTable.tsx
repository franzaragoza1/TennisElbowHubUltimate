"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

/** Un valor ausente se pinta con un guion, nunca con una celda vacía (CLAUDE.md §6). */
const DASH = "—";

interface LeaderRowBase {
  playerId: number;
  displayName: string;
  country: string | null;
  avatarUrl: string | null;
  matchesCounted: number;
}

export type LeaderColumnKind = "pct" | "count" | "speed" | "rating";

/**
 * SOLO datos planos serializables — nunca funciones. `LeadersTable` es un Client
 * Component y `app/stats/page.tsx` (Server Component) construye estas columnas; una
 * función (`format`/`sortValue` como closures) no puede cruzar esa frontera — React
 * la rechaza en tiempo de ejecución ("Functions cannot be passed directly to Client
 * Components"), aunque compile sin quejarse. El formato y el orden se resuelven aquí
 * dentro a partir de `key`+`kind`, no de una función recibida por prop.
 */
export interface LeaderColumn<T> {
  key: keyof T & string;
  label: string;
  kind: LeaderColumnKind;
}

function formatValue(value: number | null, kind: LeaderColumnKind): string {
  if (value === null) return DASH;
  if (kind === "pct") return `${value}%`;
  if (kind === "speed") return `${value} km/h`;
  if (kind === "rating") return value.toFixed(1);
  return value.toLocaleString("en-US");
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="tour-numeric text-headline inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-ink">
      {rank}
    </span>
  );
}

function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  if (!direction) return <span className="inline-block w-3" aria-hidden="true" />;
  return (
    <span aria-hidden="true" className="text-accent-500">
      {direction === "desc" ? "▼" : "▲"}
    </span>
  );
}

/**
 * Tabla de leaderboard genérica y ordenable en cliente — sin nuevas peticiones al
 * servidor al cambiar de columna: el conjunto ya cargado (Top N) se reordena entero en
 * el navegador, igual que hace la referencia ATP. El "Rank" siempre refleja el orden
 * ACTUAL (recalculado tras cada reordenación), nunca el orden con el que llegó del
 * servidor.
 */
export function LeadersTable<T extends LeaderRowBase>({
  rows,
  columns,
  defaultSortKey,
}: {
  rows: T[];
  columns: LeaderColumn<T>[];
  defaultSortKey: string;
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const va = a[col.key] as unknown as number | null;
      const vb = b[col.key] as unknown as number | null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [rows, columns, sortKey, sortDir]);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
        Not enough matches with recorded stats yet for this category.
      </p>
    );
  }

  return (
    // `nav-scroll` (app/globals.css) oculta la barra de scroll nativa — el mismo
    // arreglo que ya lleva la barra de secciones de SiteNav: el scroll horizontal se
    // mantiene en pantallas estrechas, pero sin la barra fea del navegador de por
    // medio (pedido explícito, con captura).
    <div className="nav-scroll overflow-x-auto rounded-lg border border-rule bg-paper shadow-sm">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper-tint text-left">
            <th className="text-eyebrow w-9 px-2 py-2 text-[11px] text-muted-label">Rank</th>
            <th className="text-eyebrow px-2 py-2 text-[11px] text-muted-label">Player</th>
            <th className="text-eyebrow hidden w-14 px-2 py-2 text-right text-[11px] text-muted-label sm:table-cell">
              Matches
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-2 py-2 text-right"
                aria-sort={sortKey === c.key ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => handleSort(c.key)}
                  className="tap-scale text-eyebrow inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-label hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  {c.label}
                  <SortIcon direction={sortKey === c.key ? sortDir : null} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.playerId}
              className="row-reveal h-12 border-b border-rule transition-colors last:border-0 hover:bg-paper-tint"
              style={{ "--reveal-delay": `${Math.min(i, 20) * 15}ms` } as React.CSSProperties}
            >
              <td className="px-2">
                <RankBadge rank={i + 1} />
              </td>
              <td className="px-2">
                <Link
                  href={`/players/${row.playerId}`}
                  className="flex min-w-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <PlayerAvatar
                    displayName={row.displayName}
                    country={row.country}
                    avatarUrl={row.avatarUrl}
                  />
                  <span className="text-headline truncate text-ink hover:underline">{row.displayName}</span>
                </Link>
              </td>
              <td className="tour-numeric hidden px-2 text-right text-muted-label sm:table-cell">
                {row.matchesCounted === 0 ? DASH : row.matchesCounted}
              </td>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`tour-numeric text-headline px-2 text-right text-ink ${c.kind === "rating" ? "text-base" : ""}`}
                >
                  {formatValue(row[c.key] as unknown as number | null, c.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DASH };
