"use client";

import { deleteFinalsEdition } from "@/app/admin/finals/actions";

/** Client component solo por el `confirm()` — igual que DeleteMatchLogFileButton: esto
 * borra en cascada participantes/partidos/sets de la Finals Y su espejo real en
 * `editions`/`matches` (ver la acción), así que merece confirmación antes de enviar. */
export function DeleteFinalsEditionButton({ finalsEditionId }: { finalsEditionId: number }) {
  return (
    <form
      action={deleteFinalsEdition}
      onSubmit={(e) => {
        if (!confirm("Delete this Finals edition? This removes its groups, matches and results everywhere on the site. This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="finalsEditionId" value={finalsEditionId} />
      <button type="submit" className="text-eyebrow shrink-0 text-xs text-down hover:underline">
        Delete
      </button>
    </form>
  );
}
