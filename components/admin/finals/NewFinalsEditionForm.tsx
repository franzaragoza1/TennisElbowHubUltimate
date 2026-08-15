"use client";

import { useState } from "react";
import { createFinalsEdition } from "@/app/admin/finals/actions";

export interface PlayerOption {
  id: number;
  displayName: string;
}

const inputClass =
  "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">{label}</span>
      {children}
    </label>
  );
}

/** Los 8 jugadores se añaden en orden — ese orden ES el seed (1º = seed 1). */
function SeedPicker({ players, seeded, onChange }: { players: PlayerOption[]; seeded: number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const byId = new Map(players.map((p) => [p.id, p]));
  const matches =
    query.trim().length === 0 || seeded.length >= 8
      ? []
      : players.filter((p) => !seeded.includes(p.id) && p.displayName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  return (
    <div>
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">Field of 8 ({seeded.length}/8)</span>
      <ol className="mb-2 space-y-1">
        {seeded.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-lg border border-rule bg-paper-tint px-3 py-1.5">
            <span className="text-eyebrow w-14 text-xs text-muted-label">Seed {i + 1}</span>
            <span className="text-ink">{byId.get(id)?.displayName ?? id}</span>
            <button
              type="button"
              onClick={() => onChange(seeded.filter((s) => s !== id))}
              className="text-eyebrow ml-auto text-xs text-down hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      {seeded.length < 8 && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search seed ${seeded.length + 1}…`}
            className={inputClass}
          />
          {matches.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...seeded, p.id]);
                      setQuery("");
                    }}
                    className="w-full px-3 py-2 text-left text-ink hover:bg-paper-tint"
                  >
                    {p.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {seeded.map((id) => (
        <input key={id} type="hidden" name="playerId" value={id} />
      ))}
    </div>
  );
}

export function NewFinalsEditionForm({ players }: { players: PlayerOption[] }) {
  const [seeded, setSeeded] = useState<number[]>([]);

  return (
    <form action={createFinalsEdition} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Type">
          <select name="kind" defaultValue="tour_finals" className={inputClass}>
            <option value="tour_finals">World Tour Finals</option>
            <option value="next_gen_finals">Next Gen Finals</option>
          </select>
        </Field>
        <Field label="Year">
          <input name="year" type="number" required defaultValue={new Date().getFullYear()} className={inputClass} />
        </Field>
      </div>

      <Field label="Display name">
        <input name="displayName" required placeholder="e.g. TE4 Tour Finals 2026" className={inputClass} />
      </Field>

      <SeedPicker players={players} seeded={seeded} onChange={setSeeded} />

      <button
        type="submit"
        disabled={seeded.length !== 8}
        className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Create edition
      </button>
    </form>
  );
}
