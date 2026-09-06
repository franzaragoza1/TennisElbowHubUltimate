"use client";

import { useEffect, useState, useTransition } from "react";
import type { MatchLogImportSummary } from "@/lib/matchLog/importMatchLog";

interface ReminderStatus {
  overdue: boolean;
  lastUploadedAt: string | null;
}

/**
 * Vive en /account para cualquier usuario con sesión (pedido explícito: "The website
 * will ask every user to upload match logs every now and then") — no solo para quien
 * ya tiene un jugador vinculado, porque la subida en sí no depende de esa identidad
 * (el casado de nombres ya resuelve contra `players`/`player_known_names`, ver
 * lib/matchLog/nameIndex.ts). El aviso de "hace tiempo que no subes" es de cortesía,
 * no un muro: el formulario de subida se ve siempre, esté o no vencido.
 */
export function MatchLogUploadPrompt() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<MatchLogImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/match-log/reminder")
      .then((res) => res.json())
      .then((data) => setStatus({ overdue: Boolean(data?.overdue), lastUploadedAt: data?.lastUploadedAt ?? null }))
      .catch(() => setStatus(null));
  }, [summary]);

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
      const res = await fetch("/api/account/match-log/upload", { method: "POST", body: formData });
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
      <h2 className="text-headline mb-1 text-lg text-ink">Upload your MatchLog stats</h2>
      <p className="text-muted-label mb-2 text-xs">
        Tennis Elbow 4 keeps a detailed stat sheet (aces, serve %, winners...) for every match you play, saved locally
        as <code>MatchLog - &lt;profile&gt;.NNN.html</code> in your{" "}
        <code>...\Tennis Elbow 4\Profiles\&lt;PROFILE&gt;</code> folder. Upload it and we&apos;ll attach real stats to
        any of your online matches that already have a recorded tour result — everything else is skipped, never
        guessed.
      </p>

      {status?.overdue && (
        <p className="text-eyebrow mb-3 rounded-md bg-accent-500 px-3 py-2 text-xs text-navy-900">
          {status.lastUploadedAt
            ? `It's been a while since your last upload (${new Date(status.lastUploadedAt).toLocaleDateString()}) — upload your latest MatchLog to keep your stats up to date.`
            : "You haven't uploaded a MatchLog yet — upload one to get your match stats on the site."}
        </p>
      )}

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
          {isPending ? "Uploading…" : "Upload"}
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
