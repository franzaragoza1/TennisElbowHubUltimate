"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSuggestions, dismissSuggestions, type NameSuggestionRow } from "@/app/admin/match-log/actions";

/** Checkboxes + "approve/dismiss selected or all", pedido explícito — antes cada fila
 * solo tenía su propio Approve/Dismiss, sin forma de atender varias a la vez. Sigue
 * habiendo un Approve/Dismiss por fila (el caso de un solo id), ahora como el mismo
 * botón que el resto, no un `<form>` aparte. */
export function SuggestedMatchesList({ suggestions }: { suggestions: NameSuggestionRow[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === suggestions.length ? new Set() : new Set(suggestions.map((s) => s.id))));
  }

  function runApprove(ids: number[]) {
    startTransition(async () => {
      await approveSuggestions(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  function runDismiss(ids: number[]) {
    startTransition(async () => {
      await dismissSuggestions(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  const allIds = suggestions.map((s) => s.id);
  const allSelected = selected.size > 0 && selected.size === suggestions.length;

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-paper-tint px-4 py-2.5">
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending || selected.size === 0}
            onClick={() => runApprove([...selected])}
            className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve selected
          </button>
          <button
            type="button"
            disabled={isPending || selected.size === 0}
            onClick={() => runDismiss([...selected])}
            className="text-eyebrow rounded-full border border-rule px-4 py-1.5 text-xs text-down hover:bg-down/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dismiss selected
          </button>
          <span className="text-muted-label text-xs">·</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runApprove(allIds)}
            className="text-eyebrow text-xs text-blue-500 hover:underline disabled:opacity-40"
          >
            Approve all
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runDismiss(allIds)}
            className="text-eyebrow text-xs text-down hover:underline disabled:opacity-40"
          >
            Dismiss all
          </button>
        </div>
      </div>

      {suggestions.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
          <div className="flex min-w-0 items-center gap-3">
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-ink">
                &quot;{s.unresolvedName}&quot; → <span className="font-semibold">{s.suggestedPlayerName}</span>
              </p>
              {s.reason && <p className="text-muted-label text-xs">{s.reason}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => runApprove([s.id])}
              className="text-eyebrow text-xs text-blue-500 hover:underline disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => runDismiss([s.id])}
              className="text-eyebrow text-xs text-down hover:underline disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
