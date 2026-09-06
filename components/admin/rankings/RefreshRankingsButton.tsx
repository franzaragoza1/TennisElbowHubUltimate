"use client";

import { useState, useTransition } from "react";
import { refreshRankingsNow } from "@/app/admin/rankings/actions";

function describeWeeks(label: string, weeks: { isoYear: number; isoWeek: number; rows: number }[]): string | null {
  if (weeks.length === 0) return null;
  return `${label}: ${weeks.map((w) => `${w.isoYear}-W${w.isoWeek} (${w.rows})`).join(", ")}`;
}

export function RefreshRankingsButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleRefresh() {
    startTransition(async () => {
      const { result, error } = await refreshRankingsNow();
      if (error) {
        setIsError(true);
        setMessage(error);
        return;
      }
      const parts = [
        describeWeeks("Official", result!.officialWeeksLoaded),
        describeWeeks("Race", result!.raceWeeksLoaded),
      ].filter((p): p is string => p !== null);

      setIsError(false);
      setMessage(
        parts.length > 0
          ? `Loaded new weeks — ${parts.join(" · ")}.`
          : `Already up to date${result!.latestAvailableWeek ? ` (latest published week: ${result!.latestAvailableWeek})` : ""}.`,
      );
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Checking…" : "Refresh rankings"}
      </button>
      {message && <p className={`mt-2 text-xs ${isError ? "text-down" : "text-muted-label"}`}>{message}</p>}
    </div>
  );
}
