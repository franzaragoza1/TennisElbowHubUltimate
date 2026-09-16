"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCountryCode, groupCountriesForFilter } from "@/lib/countryCodes";

export interface PlayerIndexRow {
  id: number;
  displayName: string;
  country: string | null;
  avatarUrl: string | null;
  currentRank: number | null;
  wins: number;
  losses: number;
  titles: number;
}

/** Los jugadores sin ranking actual (retirados, inactivos) van al final, no arriba, y
 * nunca entran en un corte "Top N" (no tienen posición que comparar). */
const UNRANKED = Number.MAX_SAFE_INTEGER;

const TOP_FILTERS = ["10", "50", "100", "all"] as const;
type TopFilter = (typeof TOP_FILTERS)[number];
const TOP_FILTER_LABEL: Record<TopFilter, string> = { "10": "Top 10", "50": "Top 50", "100": "Top 100", all: "All players" };

/** La rejilla anterior a la réplica ATP (2026-09-17) tenía estos mismos tres criterios
 * como botones de "sort by" — se cayeron sin querer al rehacer la tarjeta, pedido
 * explícito de traerlos de vuelta: "add filtering by rank or titles or name". */
const SORT_KEYS = ["rank", "name", "titles"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABEL: Record<SortKey, string> = { rank: "Sort: Ranking", name: "Sort: Name", titles: "Sort: Titles" };

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/**
 * Tarjeta calcada de la rejilla de jugadores de atptour.com — pedido explícito
 * (2026-09-17): avatar circular con la insignia de ranking solapando el borde
 * inferior, nombre centrado (envuelve en dos líneas, nunca trunca), bandera debajo. Sin
 * la línea de W-L/títulos que tenía la tarjeta anterior — la referencia tampoco la
 * lleva aquí, esa cifra vive en la ficha del propio jugador.
 */
function PlayerCard({ player, index }: { player: PlayerIndexRow; index: number }) {
  return (
    <Link
      href={`/players/${player.id}`}
      prefetch={false}
      className="row-reveal hover-lift flex flex-col items-center gap-2 rounded-lg border border-rule bg-paper p-4 text-center transition hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      style={{ "--reveal-delay": `${Math.min(index, 24) * 12}ms` } as React.CSSProperties}
    >
      <div className="relative">
        <PlayerAvatar displayName={player.displayName} country={player.country} avatarUrl={player.avatarUrl} size="lg" />
        {player.currentRank && (
          <span className="tour-numeric text-eyebrow absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-blue-500 bg-paper px-2 py-0.5 text-xs text-blue-500 shadow-sm">
            {player.currentRank}
          </span>
        )}
      </div>
      <p className="text-headline mt-1 text-sm text-ink">{player.displayName}</p>
      <CountryFlag country={player.country} className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule object-cover" />
    </Link>
  );
}

export function PlayerIndex({ players }: { players: PlayerIndexRow[] }) {
  const [query, setQuery] = useState("");
  // "Top 10" por defecto, no "All" — la referencia arranca así, y con ~700 jugadores en
  // el archivo, "All" de entrada era una rejilla de miles de píxeles de alto antes de
  // que nadie tocara un filtro (bug real visto en la primera pasada de este pedido).
  const [topFilter, setTopFilter] = useState<TopFilter>("10");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<SortKey>("rank");

  const countryOptions = useMemo(() => groupCountriesForFilter(players.map((p) => p.country)), [players]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = q
      ? players.filter((p) => p.displayName.toLowerCase().includes(q) || (p.country ?? "").toLowerCase().includes(q))
      : players;

    if (country !== "all") {
      filtered = filtered.filter((p) => (getCountryCode(p.country) ?? p.country) === country);
    }

    // Ordenar ANTES de cortar por "Top N" — pedido explícito (2026-09-17): "it
    // shouldnt first show the top 10 ranked players and then sort them, but sort
    // first". Antes el corte filtraba por RANKING ACTUAL siempre (incluso eligiendo
    // "Sort: Titles"), así que "Top 10" + "Sort: Titles" solo reordenaba a los 10 ya
    // mejor clasificados en vez de enseñar a los 10 con más títulos de verdad — y de
    // paso excluía a cualquier jugador sin ranking actual (retirado o inactivo),
    // aunque tuviera más títulos que medio Top 10. Ordenar primero y cortar después
    // arregla las dos cosas: el corte ahora es posicional sobre el orden ya elegido,
    // así que un retirado con muchos títulos SÍ puede entrar en un "Top 10" por
    // títulos, cosa que nunca podía pasar antes.
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "titles") return b.titles - a.titles || a.displayName.localeCompare(b.displayName);
      return (a.currentRank ?? UNRANKED) - (b.currentRank ?? UNRANKED) || a.displayName.localeCompare(b.displayName);
    });

    // El corte solo se aplica sin búsqueda activa — alguien buscando un nombre
    // concreto quiere encontrarlo aunque caiga fuera del "Top 10" seleccionado, no un
    // "no matches" confuso por un filtro que ni siquiera tocó a propósito.
    if (!q && topFilter !== "all") return sorted.slice(0, Number(topFilter));
    return sorted;
  }, [players, query, topFilter, country, sort]);

  return (
    <div>
      <div className="relative mb-4">
        <span className="text-muted-label pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all players"
          className="w-full rounded-full border border-rule bg-paper py-3 pr-5 pl-12 text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select value={topFilter} onValueChange={(v) => setTopFilter(v as TopFilter)}>
          <SelectTrigger className="text-eyebrow w-auto rounded-full border border-rule bg-paper text-xs">
            {/* Base UI `Select.Value` pinta el `value` en bruto por defecto (a
             * diferencia de Radix, no refleja los `children` del `SelectItem`
             * seleccionado) — de ahí la función, para que la píldora diga "Top 10" en
             * vez de "10" a secas. */}
            <SelectValue>{(v: string) => TOP_FILTER_LABEL[v as TopFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TOP_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {TOP_FILTER_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {countryOptions.length > 0 && (
          <Select value={country} onValueChange={(v) => setCountry(v ?? "all")}>
            <SelectTrigger className="text-eyebrow w-auto rounded-full border border-rule bg-paper text-xs">
              <SelectValue>
                {(v: string) => (v === "all" ? "Country (All)" : (countryOptions.find((c) => c.value === v)?.label ?? v))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Country (All)</SelectItem>
              {countryOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-2">
                    {c.code && (
                      // eslint-disable-next-line @next/next/no-img-element -- icono decorativo diminuto, no vale la pena el pipeline de next/image
                      <img
                        src={`/flags/${c.code.toLowerCase()}.svg`}
                        alt=""
                        className="h-3 w-4 shrink-0 overflow-hidden rounded-sm bg-rule object-cover"
                      />
                    )}
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sort} onValueChange={(v) => setSort((v as SortKey | null) ?? "rank")}>
          <SelectTrigger className="text-eyebrow w-auto rounded-full border border-rule bg-paper text-xs">
            <SelectValue>{(v: string) => SORT_LABEL[v as SortKey]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-muted-label tour-numeric text-xs sm:ml-auto">
          {visible.length} of {players.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-label py-12 text-center">No players match that search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visible.map((p, i) => (
            <PlayerCard key={p.id} player={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
