"use client";

import { useState, useTransition } from "react";
import { syncVideosNow } from "@/app/admin/videos/actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSync() {
    startTransition(async () => {
      const { result, error } = await syncVideosNow();
      if (error) {
        setIsError(true);
        setMessage(error);
        return;
      }
      setIsError(false);
      setMessage(
        `Scanned ${result!.scanned} — ${result!.autoLinked} auto-linked, ${result!.pending} queued for review, ${result!.skipped} skipped, ${result!.renamed} updated (title changed on YouTube)`,
      );
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {message && <p className={`mt-2 text-xs ${isError ? "text-down" : "text-muted-label"}`}>{message}</p>}
    </div>
  );
}
