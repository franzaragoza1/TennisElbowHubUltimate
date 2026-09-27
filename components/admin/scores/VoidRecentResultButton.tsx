"use client";

import { voidRecentResult } from "@/app/admin/scores/actions";

/** Client component solo por el `confirm()` — mismo criterio que
 * DeleteMatchLogFileButton.tsx: borrar un resultado reportado por error merece
 * confirmación antes de enviarlo, no un simple clic sin red de seguridad. */
export function VoidRecentResultButton({ resultId }: { resultId: number }) {
  return (
    <form
      action={voidRecentResult}
      onSubmit={(e) => {
        if (!confirm("Remove this result from the site? It only affects our /scores page — if Mana Games still shows the same result, a future refresh could bring it back.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="resultId" value={resultId} />
      <button type="submit" className="text-eyebrow shrink-0 text-xs text-down hover:underline">
        Void
      </button>
    </form>
  );
}
