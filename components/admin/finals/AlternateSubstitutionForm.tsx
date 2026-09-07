"use client";

import { useTransition } from "react";
import { substituteAlternate } from "@/app/admin/finals/actions";

export interface AlternateCandidate {
  id: number;
  displayName: string;
}

export function AlternateSubstitutionForm({
  participantId,
  displayName,
  candidates,
  onSubstituted,
}: {
  participantId: number;
  displayName: string;
  candidates: AlternateCandidate[];
  onSubstituted: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await substituteAlternate(formData);
      onSubstituted();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper px-3 py-2">
      <input type="hidden" name="participantId" value={participantId} />
      <span className="text-ink min-w-0 flex-1 truncate text-sm">{displayName}</span>
      <select name="alternatePlayerId" required defaultValue="" className="rounded border border-rule px-2 py-1 text-sm text-ink">
        <option value="" disabled>
          Replace with…
        </option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isPending} className="text-eyebrow text-xs text-down hover:underline disabled:opacity-50">
        Withdraw &amp; substitute
      </button>
    </form>
  );
}
