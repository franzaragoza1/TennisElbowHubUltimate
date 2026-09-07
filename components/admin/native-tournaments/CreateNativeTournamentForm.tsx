"use client";

import { useState, useTransition } from "react";
import { createNativeTournament } from "@/app/admin/native-tournaments/actions";

const CATEGORIES = ["Grand Slam", "Masters 1000", "500", "250", "CT 125", "CT 110", "CT 100", "CT 90", "CT 80", "CT 75", "Future"];
const SURFACES = ["Hard", "Clay", "Grass", "Indoor"];
const DRAW_SIZES = [8, 16, 32, 64, 128];

export function CreateNativeTournamentForm({ onCreated }: { onCreated: (editionId: number) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error, editionId } = await createNativeTournament(formData);
      if (error || editionId === null) {
        setError(error ?? "Something went wrong.");
        return;
      }
      onCreated(editionId);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-rule bg-paper p-4">
      <label className="block">
        <span className="text-eyebrow mb-1 block text-xs text-muted-label">Tournament name</span>
        <input type="text" name="eventName" required className="w-full max-w-sm rounded border border-rule px-3 py-2 text-sm text-ink" />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Tier</span>
          <select name="category" required defaultValue="" className="rounded border border-rule px-3 py-2 text-sm text-ink">
            <option value="" disabled>
              Select…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Surface</span>
          <select name="surface" required defaultValue="" className="rounded border border-rule px-3 py-2 text-sm text-ink">
            <option value="" disabled>
              Select…
            </option>
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Draw size</span>
          <select name="drawSize" required defaultValue="" className="rounded border border-rule px-3 py-2 text-sm text-ink">
            <option value="" disabled>
              Select…
            </option>
            {DRAW_SIZES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Start date</span>
          <input type="date" name="date" required className="rounded border border-rule px-3 py-2 text-sm text-ink" />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow self-start rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create tournament"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
