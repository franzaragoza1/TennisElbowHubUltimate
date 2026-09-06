"use client";

import { deleteMatchLogFile } from "@/app/admin/match-log/actions";

/** Client component solo por el `confirm()` — a diferencia de un borrado de
 * historial normal (p.ej. `deleteNews`), esto también borra `match_stats` reales en
 * cascada (ver db/schema.ts), así que merece una confirmación antes de enviar. */
export function DeleteMatchLogFileButton({ fileId }: { fileId: number }) {
  return (
    <form
      action={deleteMatchLogFile}
      onSubmit={(e) => {
        if (!confirm("Delete this upload and the match stats it linked? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="fileId" value={fileId} />
      <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
        Delete
      </button>
    </form>
  );
}
