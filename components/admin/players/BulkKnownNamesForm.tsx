"use client";

import { useActionState } from "react";
import { bulkAddKnownNames, type BulkKnownNamesOutcome } from "@/app/admin/players/actions";

const INITIAL_STATE: BulkKnownNamesOutcome = { linked: [], failed: [], malformed: [] };

export function BulkKnownNamesForm() {
  const [state, formAction, pending] = useActionState(bulkAddKnownNames, INITIAL_STATE);
  const hasResult = state.linked.length > 0 || state.failed.length > 0 || state.malformed.length > 0;

  return (
    <div className="mb-6 rounded-lg border border-rule bg-paper p-4">
      <h2 className="text-headline mb-1 text-sm text-ink">Bulk add known names</h2>
      <p className="text-muted-label mb-3 text-xs">
        One player per block, separated by <code>;</code> —{" "}
        <code>Player Name: old name, nickname; Other Player: old name</code>. Each name is matched against the
        player&apos;s exact current display name.
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <textarea
          name="bulkText"
          rows={3}
          placeholder="Gyrmik: OldNick, M.Girardi; Jira: Jirko"
          className="w-full rounded border border-rule px-3 py-2 text-sm text-ink"
        />
        <div>
          <button
            type="submit"
            disabled={pending}
            className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add all"}
          </button>
        </div>
      </form>

      {hasResult && (
        <div className="mt-3 space-y-1 text-xs">
          {state.linked.map((l) => (
            <p key={l.playerId} className="text-ink">
              ✓ {l.displayName}: {l.addedCount} name{l.addedCount === 1 ? "" : "s"} added.
            </p>
          ))}
          {state.failed.map((f, i) => (
            <p key={`failed-${i}`} className="text-down">
              ✗ &quot;{f.nameQuery}&quot;: {f.reason}.
            </p>
          ))}
          {state.malformed.map((m, i) => (
            <p key={`malformed-${i}`} className="text-down">
              ✗ Couldn&apos;t read &quot;{m}&quot; — expected &quot;Name: alias1, alias2&quot;.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
