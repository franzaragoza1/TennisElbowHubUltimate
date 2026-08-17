"use client";

import { reassignAlias } from "@/app/admin/players/actions";

export interface AliasReassignCandidate {
  id: number;
  displayName: string;
}

export function AliasReassignForm({
  aliasId,
  currentPlayerId,
  sourceSlug,
  externalId,
  displayName,
  candidates,
}: {
  aliasId: number;
  currentPlayerId: number;
  sourceSlug: string;
  externalId: string;
  displayName: string;
  candidates: AliasReassignCandidate[];
}) {
  return (
    <form action={reassignAlias} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper px-3 py-2">
      <input type="hidden" name="aliasId" value={aliasId} />
      <input type="hidden" name="currentPlayerId" value={currentPlayerId} />
      <div className="min-w-0 flex-1">
        <p className="text-ink truncate text-sm">{displayName}</p>
        <p className="text-muted-label text-xs">
          {sourceSlug} · {externalId}
        </p>
      </div>
      <select name="targetPlayerId" required defaultValue="" className="rounded border border-rule px-2 py-1 text-sm text-ink">
        <option value="" disabled>
          Reassign to…
        </option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
      <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
        Move alias
      </button>
    </form>
  );
}
