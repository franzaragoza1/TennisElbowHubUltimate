"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateNewsDrafts, type GenerateNewsSummary } from "@/app/admin/news/actions";

const DEFAULT_DAYS_BACK = 14;

export function GenerateNewsPanel() {
  const [daysBack, setDaysBack] = useState(String(DEFAULT_DAYS_BACK));
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<GenerateNewsSummary | null>(null);

  function handleGenerate() {
    const n = Math.min(90, Math.max(1, Number(daysBack) || DEFAULT_DAYS_BACK));
    startTransition(async () => {
      setSummary(await generateNewsDrafts(n));
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-paper p-5">
      <p className="text-muted-label mb-4 text-xs">
        Scans results, streaks, upsets and ranking movement imported in the last N days and asks the model to
        draft a story for each one it finds — using only numbers already in the database, never invented ones.
        Every draft lands with status <span className="text-ink">draft</span> in the list above: nothing is
        published automatically. Requests to the model are paced to stay under its rate limit, so a wide window
        with many candidates can take a few minutes — the button stays disabled until it's done.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-eyebrow text-xs text-muted-label" htmlFor="daysBack">
          Days back
        </label>
        <input
          id="daysBack"
          type="number"
          min={1}
          max={90}
          value={daysBack}
          onChange={(e) => setDaysBack(e.target.value)}
          disabled={isPending}
          className="w-20 rounded border border-rule px-2 py-1 text-sm text-ink"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate"}
        </button>
      </div>

      {summary && (
        <div className="mt-5">
          <p className="text-ink mb-3 text-sm">
            {summary.totalDrafted === 0
              ? "No new drafts — see the breakdown below for why."
              : `${summary.totalDrafted} new draft${summary.totalDrafted === 1 ? "" : "s"} added.`}{" "}
            {summary.totalDrafted > 0 && (
              <Link href="/admin" className="text-blue-500 hover:underline">
                Review them
              </Link>
            )}
          </p>
          <div className="overflow-hidden rounded-lg border border-rule">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-tint text-muted-label">
                <tr>
                  <th className="px-3 py-2 font-normal">Detector</th>
                  <th className="px-3 py-2 text-right font-normal">Found</th>
                  <th className="px-3 py-2 text-right font-normal">Already had</th>
                  <th className="px-3 py-2 text-right font-normal">Drafted</th>
                  <th className="px-3 py-2 text-right font-normal">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {summary.detectors.map((d) => (
                  <tr key={d.kind} className="border-t border-rule">
                    <td className="px-3 py-2 text-ink">{d.label}</td>
                    <td className="tour-numeric px-3 py-2 text-right text-ink">{d.candidates}</td>
                    <td className="tour-numeric px-3 py-2 text-right text-muted-label">{d.alreadyExisting}</td>
                    <td className="tour-numeric px-3 py-2 text-right text-up">{d.drafted}</td>
                    <td className="tour-numeric px-3 py-2 text-right text-down">{d.failedGuardrail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-label mt-2 text-[11px]">
            "Rejected" means the model's answer didn't pass the guardrail (an invented number, wrong shape, or
            timeout) — nothing unsafe was published, it just skipped that one.
          </p>
        </div>
      )}
    </div>
  );
}
