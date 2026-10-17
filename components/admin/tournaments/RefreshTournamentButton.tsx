"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOrRefreshTournament } from "@/app/admin/tournaments/actions";

/** "Refresh" en una fila de la lista de torneos abiertos: pide la misma recarga que el
 * formulario de arriba, sin tener que pegar el número. */
export function RefreshTournamentButton({ externalId }: { externalId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "queued" | "done" | "error">("idle");

  function refresh() {
    startTransition(async () => {
      const { error, queued } = await addOrRefreshTournament(externalId);
      setState(error ? "error" : queued ? "queued" : "done");
      router.refresh();
    });
  }

  const label = isPending ? "…" : state === "queued" ? "Queued" : state === "done" ? "Done" : state === "error" ? "Failed" : "Refresh";
  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending || state === "queued"}
      className={`text-eyebrow shrink-0 rounded-full border px-3 py-1 text-[10px] transition-colors disabled:opacity-60 ${
        state === "error" ? "border-down text-down" : "border-rule text-ink hover:border-blue-500 hover:text-blue-500"
      }`}
    >
      {label}
    </button>
  );
}
