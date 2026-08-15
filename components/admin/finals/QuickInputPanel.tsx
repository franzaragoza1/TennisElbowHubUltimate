"use client";

import { useState, useTransition } from "react";
import { applyQuickInput, type QuickInputLineOutcome } from "@/app/admin/finals/actions";

export function QuickInputPanel({ finalsEditionId }: { finalsEditionId: number }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<QuickInputLineOutcome[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const outcome = await applyQuickInput(finalsEditionId, text);
      setResults(outcome);
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <p className="text-eyebrow mb-2 text-xs text-muted-label">Quick input</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"M. Arnaldi def. J.I 6/4 7/6(5)\nlord goatic d. Tomico 6-2 3-6 6-4"}
        className="w-full rounded-lg border border-rule bg-paper px-3 py-2 font-mono text-sm text-ink outline-none focus-visible:border-blue-500"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || text.trim().length === 0}
        className="text-eyebrow mt-2 rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Applying…" : "Apply results"}
      </button>

      {results.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {results.map((r) => (
            <li key={r.lineNumber} className={r.error ? "text-down" : "text-up"}>
              Line {r.lineNumber}: {r.error ?? "Saved"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
