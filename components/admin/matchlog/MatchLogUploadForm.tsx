"use client";

import { useState, useTransition } from "react";
import type { MatchLogImportSummary } from "@/lib/matchLog/importMatchLog";

export function MatchLogUploadForm() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<MatchLogImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const formData = new FormData();
    for (const file of Array.from(input.files)) formData.append("files", file);

    startTransition(async () => {
      setError(null);
      setSummary(null);
      const res = await fetch("/api/admin/match-log/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setSummary(data.summary as MatchLogImportSummary);
      form.reset();
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-paper p-5">
      <h2 className="text-headline mb-1 text-lg text-ink">Upload MatchLog files</h2>
      <p className="text-muted-label mb-4 text-xs">
        Upload one or more <code>MatchLog - &lt;profile&gt;.NNN.html</code> files (from a player&apos;s local{" "}
        <code>...\Tennis Elbow 4\Profiles\&lt;PROFILE&gt;</code> folder). Only [Online] matches that already exist as
        a recorded tour result (same two players, same set-by-set score) get real stats attached — everything else
        (practice, AI opponents, casual games with no matching tour record) is recognised and skipped, never guessed.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          type="file"
          name="files"
          multiple
          accept=".html"
          disabled={isPending}
          className="text-ink flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:text-white"
        />
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow shrink-0 rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Uploading…" : "Upload & link"}
        </button>
      </form>

      {error && <p className="text-down mt-3 text-xs">{error}</p>}

      {summary && (
        <div className="mt-4 space-y-1.5">
          <p className="text-ink text-xs font-semibold">
            {summary.totalLinked} match{summary.totalLinked === 1 ? "" : "es"} linked to the tour, {summary.totalSkipped}{" "}
            skipped.
          </p>
          {summary.results.map((r) => (
            <p key={r.fileName} className="text-muted-label text-xs">
              <span className="text-ink">{r.fileName}</span>: {r.totalOnlineEntries} online entries — {r.linked} linked,{" "}
              {r.skipped} skipped.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
