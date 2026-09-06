"use client";

import { unlinkPlayerAccount } from "@/app/admin/players/actions";

/** Client component solo por el `confirm()` — mismo criterio que
 * DeleteMatchLogFileButton/DeleteFinalsEditionButton: esto le quita el acceso a la
 * cuenta que hoy controla este perfil (editor de avatar, próximo rival...), así que
 * merece confirmación antes de enviar. */
export function UnlinkAccountButton({ playerId }: { playerId: number }) {
  return (
    <form
      action={unlinkPlayerAccount}
      onSubmit={(e) => {
        if (!confirm("Unlink this Discord account from the player profile? They will lose access to it (avatar editor, next opponent, etc.) until someone claims it again.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="playerId" value={playerId} />
      <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
        Unlink
      </button>
    </form>
  );
}
