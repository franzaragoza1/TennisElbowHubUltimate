"use client";

import { useActionState } from "react";
import { refreshAllFiles } from "@/app/admin/match-log/actions";
import type { MatchLogImportSummary } from "@/lib/matchLog/importMatchLog";

/** "Refresh all" — pedido explícito: reprocesar cada fichero ya subido de una sola
 * vez, sin ir botón por botón. Mismo patrón que NameSuggestionScanForm. */
export function RefreshAllButton() {
  const [state, formAction, pending] = useActionState<MatchLogImportSummary | null, FormData>(refreshAllFiles, null);

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="text-eyebrow rounded-full border border-rule px-4 py-1.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Refreshing all…" : "Refresh all"}
        </button>
      </form>
      {state && (
        <p className="text-muted-label mt-2 text-xs">
          Refreshed {state.results.length} file{state.results.length === 1 ? "" : "s"} — {state.totalLinked} linked,{" "}
          {state.totalSkipped} skipped.
        </p>
      )}
    </div>
  );
}
