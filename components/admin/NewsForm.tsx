"use client";

import { useState } from "react";
import { saveNews } from "@/app/admin/actions";
import { NEWS_CATEGORIES } from "@/lib/newsCategories";

export interface NewsFormValues {
  id: number | null;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  imageUrl: string;
  editionId: number | null;
  published: boolean;
  playerIds: number[];
}

export interface TagOption {
  id: number;
  displayName: string;
}

export interface EditionOption {
  id: number;
  label: string;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">{label}</span>
      {children}
      {hint && <span className="text-muted-label mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-navy-900 outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30";

/** Buscador que añade jugadores a la lista de etiquetados. */
function PlayerTagger({
  players,
  selected,
  onChange,
}: {
  players: TagOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const byId = new Map(players.map((p) => [p.id, p]));
  const matches =
    query.trim().length === 0
      ? []
      : players
          .filter(
            (p) =>
              !selected.includes(p.id) &&
              p.displayName.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .slice(0, 6);

  return (
    <div>
      <span className="text-eyebrow mb-1 block text-xs text-muted-label">
        Tagged players
      </span>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(selected.filter((s) => s !== id))}
              className="text-eyebrow rounded-full bg-navy-900 px-3 py-1 text-[11px] text-white hover:bg-down"
            >
              {byId.get(id)?.displayName ?? id} ×
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a player to tag…"
        className={inputClass}
      />
      {matches.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...selected, p.id]);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-navy-900 hover:bg-paper-tint"
              >
                {p.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input type="hidden" name="playerIds" value={selected.join(",")} />
    </div>
  );
}

export function NewsForm({
  values,
  players,
  editions,
}: {
  values: NewsFormValues;
  players: TagOption[];
  editions: EditionOption[];
}) {
  const [tagged, setTagged] = useState<number[]>(values.playerIds);

  return (
    <form action={saveNews} className="space-y-5">
      {values.id !== null && <input type="hidden" name="id" value={values.id} />}

      <Field label="Headline">
        <input name="title" defaultValue={values.title} required className={inputClass} />
      </Field>

      <Field label="Standfirst" hint="One or two lines. This is what shows on the home page card.">
        <textarea
          name="excerpt"
          defaultValue={values.excerpt}
          required
          rows={2}
          className={inputClass}
        />
      </Field>

      <Field label="Body" hint="Blank line between paragraphs.">
        <textarea
          name="body"
          defaultValue={values.body}
          required
          rows={12}
          className={`${inputClass} font-mono text-sm`}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Category">
          <select name="category" defaultValue={values.category} className={inputClass}>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tournament" hint="Optional. Colours the card with the court surface.">
          <select
            name="editionId"
            defaultValue={values.editionId ? String(values.editionId) : ""}
            className={inputClass}
          >
            <option value="">None</option>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Image URL" hint="Optional. Left empty, the card falls back to a colour block.">
        <input
          name="imageUrl"
          type="url"
          defaultValue={values.imageUrl}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      <PlayerTagger players={players} selected={tagged} onChange={setTagged} />

      <label className="flex items-center gap-3 rounded-lg border border-rule bg-paper px-4 py-3">
        <input
          type="checkbox"
          name="publish"
          defaultChecked={values.published}
          className="h-4 w-4 accent-navy-900"
        />
        <span className="text-navy-900">
          Published
          <span className="text-muted-label block text-xs">
            Unchecked, it stays a draft and never reaches the home page.
          </span>
        </span>
      </label>

      <button
        type="submit"
        className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800"
      >
        Save
      </button>
    </form>
  );
}
