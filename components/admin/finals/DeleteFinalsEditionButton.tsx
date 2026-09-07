"use client";

import { useTransition } from "react";
import { deleteFinalsEdition } from "@/app/admin/finals/actions";

/** El `confirm()` — igual que DeleteMatchLogFileButton: esto borra en cascada
 * participantes/partidos/sets de la Finals Y su espejo real en `editions`/`matches`
 * (ver la acción), así que merece confirmación antes de enviar. `onDeleted` es
 * opcional: la lista de ediciones (components/admin/sections/FinalsSection.tsx) no
 * lo necesita (el borrado ya la refresca sola), pero la vista de detalle de UNA
 * edición sí — tiene que volver a la lista, no quedarse mirando algo que ya no existe. */
export function DeleteFinalsEditionButton({ finalsEditionId, onDeleted }: { finalsEditionId: number; onDeleted?: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Delete this Finals edition? This removes its groups, matches and results everywhere on the site. This can't be undone.")) {
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("finalsEditionId", String(finalsEditionId));
      await deleteFinalsEdition(formData);
      onDeleted?.();
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="text-eyebrow shrink-0 text-xs text-down hover:underline disabled:opacity-50">
      Delete
    </button>
  );
}
