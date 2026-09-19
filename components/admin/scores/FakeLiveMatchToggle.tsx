"use client";

import { useState, useTransition } from "react";
import { toggleFakeLiveMatch } from "@/app/admin/scores/actions";

export function FakeLiveMatchToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    startTransition(async () => {
      await toggleFakeLiveMatch(next);
      setEnabled(next);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`text-eyebrow rounded-full px-5 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-down text-white hover:brightness-95" : "bg-navy-900 text-white hover:bg-navy-800"
        }`}
      >
        {isPending ? "Working…" : enabled ? "Remove fake live match" : "Inject fake live match"}
      </button>
      {enabled && <p className="text-muted-label mt-2 text-xs">Ace Ventura vs. Bjorn Bold is showing on /scores and the Live Now strip.</p>}
    </div>
  );
}
