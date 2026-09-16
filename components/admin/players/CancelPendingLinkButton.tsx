"use client";

import { cancelPendingLink } from "@/app/admin/players/linking/actions";

/** Hermano de UnlinkAccountButton.tsx para una propuesta todavía sin confirmar — sin
 * `confirm()` a propósito, a diferencia de aquel: esto nunca llegó a vincularse de
 * verdad, así que cancelarlo no le quita acceso a nadie. */
export function CancelPendingLinkButton({ playerId }: { playerId: number }) {
  return (
    <form action={cancelPendingLink}>
      <input type="hidden" name="playerId" value={playerId} />
      <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
        Cancel
      </button>
    </form>
  );
}
