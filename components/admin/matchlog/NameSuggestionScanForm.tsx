"use client";

import { useActionState } from "react";
import { scanForNameSuggestions } from "@/app/admin/match-log/actions";
import type { SuggestMatchesResult } from "@/lib/matchLog/suggestNameMatches";

export function NameSuggestionScanForm() {
  const [state, formAction, pending] = useActionState<SuggestMatchesResult | null, FormData>(
    scanForNameSuggestions,
    null,
  );

  return (
    <div className="mb-4">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Asking…" : "Find matches with AI"}
        </button>
      </form>
      {state && (
        <p className="text-muted-label mt-2 text-xs">
          {state.scanned === 0
            ? "Nothing new to check — every unresolved name already has a known name, a pending suggestion, or was already ruled out."
            : `Checked ${state.scanned} unresolved name${state.scanned === 1 ? "" : "s"}, found ${state.suggested} possible match${state.suggested === 1 ? "" : "es"} below.`}
        </p>
      )}
    </div>
  );
}
