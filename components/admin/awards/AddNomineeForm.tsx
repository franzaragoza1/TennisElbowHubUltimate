"use client";

import { useRef, useState, useTransition } from "react";
import { addAdminNomination, searchMatchCandidatesForPeriod } from "@/app/admin/awards/actions";
import type { MatchCandidateOption } from "@/app/admin/videos/actions";
import { categoriesForCycle, getAwardCategory, type AwardCycle } from "@/lib/awards/catalog";

export interface PlayerOption {
  id: number;
  displayName: string;
}

const inputClass =
  "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30";

/** Selector de UN jugador por búsqueda — mismo patrón que SeedPicker
 * (components/admin/finals/NewFinalsEditionForm.tsx) pero single-select en vez de
 * construir una lista de 8. */
function PlayerPicker({ players, value, onChange }: { players: PlayerOption[]; value: number | null; onChange: (id: number | null) => void }) {
  const [query, setQuery] = useState("");
  const selected = players.find((p) => p.id === value) ?? null;
  const matches = query.trim().length === 0 ? [] : players.filter((p) => p.displayName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rule bg-paper-tint px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{selected.displayName}</span>
        <button type="button" onClick={() => onChange(null)} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player…" className={inputClass} />
      {matches.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint"
              >
                {p.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Selector de UN partido por búsqueda, acotada al período que se está curando
 * (searchMatchCandidatesForPeriod — nunca la búsqueda genérica sin fecha de
 * app/admin/videos/actions.ts, pensada para emparejar un VOD de cualquier año). Guarda
 * el nº de petición en curso para descartar una respuesta que llegue tarde: sin esto,
 * escribir rápido ("g" -> "gi" -> "gif" -> "gifu") podía dejar en pantalla el
 * resultado de una tecla anterior si esa petición volvía después que la última —
 * bug real reportado ("search not working when going past an existing name"). */
function MatchPicker({ periodId, value, onChange }: { periodId: number; value: MatchCandidateOption | null; onChange: (m: MatchCandidateOption | null) => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MatchCandidateOption[]>([]);
  const [, startTransition] = useTransition();
  const latestRequestId = useRef(0);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      latestRequestId.current += 1;
      setOptions([]);
      return;
    }
    const requestId = ++latestRequestId.current;
    startTransition(async () => {
      const results = await searchMatchCandidatesForPeriod(periodId, q);
      if (requestId === latestRequestId.current) setOptions(results);
    });
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rule bg-paper-tint px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <input value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Search by player or tournament…" className={inputClass} />
      {options.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(o);
                  setQuery("");
                  setOptions([]);
                }}
                className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 'point_of_month' nunca aparece aquí — pedido explícito: es la única categoría con
 * envío público de clip, un admin nunca añade un nominado ahí directamente (ver
 * app/admin/awards/actions.ts::addAdminNomination). */
export function AddNomineeForm({ periodId, cycle, players, onAdded }: { periodId: number; cycle: AwardCycle; players: PlayerOption[]; onAdded: () => void }) {
  const categories = categoriesForCycle(cycle).filter((c) => c.key !== "point_of_month");
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? "");
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [match, setMatch] = useState<MatchCandidateOption | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const category = getAwardCategory(categoryKey);
  const needsPlayer = category?.nomineeKind === "player" || category?.nomineeKind === "player_in_match";
  const needsMatch = category?.nomineeKind === "match" || category?.nomineeKind === "player_in_match";
  const canSubmit = (!needsPlayer || playerId !== null) && (!needsMatch || match !== null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("periodId", String(periodId));
    formData.set("categoryKey", categoryKey);
    if (playerId !== null) formData.set("playerId", String(playerId));
    if (match !== null) formData.set("matchId", String(match.id));
    if (caption.trim()) formData.set("caption", caption.trim());

    startTransition(async () => {
      const { error } = await addAdminNomination(formData);
      if (error) {
        setError(error);
        return;
      }
      setPlayerId(null);
      setMatch(null);
      setCaption("");
      onAdded();
    });
  }

  if (categories.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-rule bg-paper-tint p-4">
      <div>
        <span className="text-eyebrow mb-1 block text-xs text-muted-label">Category</span>
        <select
          value={categoryKey}
          onChange={(e) => {
            setCategoryKey(e.target.value);
            setPlayerId(null);
            setMatch(null);
          }}
          className={inputClass}
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>

      {needsPlayer && (
        <div>
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Player</span>
          <PlayerPicker players={players} value={playerId} onChange={setPlayerId} />
        </div>
      )}

      {needsMatch && (
        <div>
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Match</span>
          <MatchPicker periodId={periodId} value={match} onChange={setMatch} />
        </div>
      )}

      <div>
        <span className="text-eyebrow mb-1 block text-xs text-muted-label">Note (optional)</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Why this nominee?" className={inputClass} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Adding…" : "Add nominee"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
