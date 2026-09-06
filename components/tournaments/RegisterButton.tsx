"use client";

import { useState, useTransition } from "react";
import { registerForTournament } from "@/app/tournaments/[id]/actions";

export function RegisterButton({ editionId }: { editionId: number }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function handleClick() {
    startTransition(async () => {
      const r = await registerForTournament(editionId);
      setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
    });
  }

  if (result?.ok) {
    return <p className="text-eyebrow text-xs text-up">You&apos;re registered.</p>;
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="text-eyebrow rounded-full bg-accent-500 px-4 py-1.5 text-[10px] text-navy-900 hover:bg-accent-500/90 disabled:opacity-50"
      >
        {isPending ? "Registering…" : "Register for this tournament"}
      </button>
      {result?.error && <p className="text-down mt-1.5 text-xs">{result.error}</p>}
    </div>
  );
}
