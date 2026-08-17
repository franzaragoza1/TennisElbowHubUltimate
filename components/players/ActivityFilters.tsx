"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CIRCUIT_LABEL, type TournamentCircuit } from "@/lib/tournamentCircuit";

export type ActivityTier = TournamentCircuit | "all";

const TIERS: ActivityTier[] = ["all", "tour", "challenger", "future"];
// "Main Tour", no "ATP Tour" (CIRCUIT_LABEL) — pedido explícito solo para esta franja;
// `/scores` (CircuitTabs) sigue con "ATP Tour", que ahí sí es la réplica deliberada de
// la referencia (CLAUDE.md §6, lib/tournamentCircuit.ts).
const TIER_LABEL: Record<ActivityTier, string> = { all: "All", ...CIRCUIT_LABEL, tour: "Main Tour" };

/** Filtros de temporada + nivel para "Player activity" — mismo criterio que
 * `RankingFilters`/`CircuitTabs`: enlaces/parámetros de URL reales, no estado local,
 * para que la vista sea compartible y funcione con el historial del navegador. */
export function ActivityFilters({
  years,
  currentYear,
  currentTier,
}: {
  years: number[];
  currentYear: number;
  currentTier: ActivityTier;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function tierHref(tier: ActivityTier): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tier", tier);
    return `${pathname}?${params.toString()}`;
  }

  function onYearChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Select value={String(currentYear)} onValueChange={onYearChange}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 bg-black text-xs font-semibold text-white shadow-sm focus-visible:ring-accent-500/70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        {TIERS.map((tier) => (
          <Link
            key={tier}
            href={tierHref(tier)}
            aria-current={tier === currentTier ? "page" : undefined}
            className={`text-eyebrow rounded-full px-4 py-2 text-xs transition ${
              tier === currentTier
                ? "bg-accent-500 text-navy-900"
                : "bg-rule/60 text-muted-label hover:bg-rule hover:text-ink"
            }`}
          >
            {TIER_LABEL[tier]}
          </Link>
        ))}
      </div>
    </div>
  );
}
