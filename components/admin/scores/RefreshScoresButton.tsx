"use client";

import { useState, useTransition } from "react";
import { refreshScoresNow } from "@/app/admin/scores/actions";

export function RefreshScoresButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleRefresh() {
    startTransition(async () => {
      const { result, error } = await refreshScoresNow();
      if (error) {
        setIsError(true);
        setMessage(error);
        return;
      }
      setIsError(false);
      setMessage(`${result!.totalParsed} results on the page, ${result!.inserted} new since the last refresh.`);
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
        {isPending ? "Refreshing…" : "Refresh now"}
      </button>
      {message && <p className={`mt-2 text-xs ${isError ? "text-down" : "text-muted-label"}`}>{message}</p>}
    </div>
  );
}
