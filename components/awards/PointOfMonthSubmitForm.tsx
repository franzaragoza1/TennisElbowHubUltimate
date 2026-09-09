"use client";

import { useState, useTransition } from "react";
import { searchMyMatchCandidates, submitPointOfMonthClip, type MyPendingSubmission } from "@/app/awards/actions";
import type { MatchCandidateOption } from "@/app/admin/videos/actions";

const inputClass =
  "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30";

/** Selector de UN partido PROPIO por búsqueda — mismo patrón que el del admin
 * (components/admin/awards/AddNomineeForm.tsx) pero contra searchMyMatchCandidates,
 * acotado a los partidos del propio jugador. */
function MatchPicker({ value, onChange }: { value: MatchCandidateOption | null; onChange: (m: MatchCandidateOption | null) => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MatchCandidateOption[]>([]);
  const [, startTransition] = useTransition();
  const [requestId, setRequestId] = useState(0);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const thisRequest = requestId + 1;
    setRequestId(thisRequest);
    startTransition(async () => {
      const results = await searchMyMatchCandidates(q);
      setRequestId((current) => {
        if (current === thisRequest) setOptions(results);
        return current;
      });
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
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        // Sin esto, Enter mientras se busca manda el <form> entero (comportamiento por
        // defecto del navegador en cualquier input de texto dentro de un form) antes de
        // que la persona llegue a elegir un partido de la lista — bug real reportado
        // ("Which match was this from? is actually mandatory": no lo es, pero Enter
        // aquí abandonaba el envío a medio completar, dando esa sensación).
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="Search one of your matches…"
        className={inputClass}
      />
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

function PendingSubmissionRow({ submission }: { submission: MyPendingSubmission }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-rule bg-paper px-3 py-2.5">
      <span className="text-eyebrow shrink-0 rounded-full bg-muted-label/10 px-2 py-0.5 text-[10px] text-muted-label">Pending review</span>
      <div className="min-w-0 flex-1">
        {submission.caption && <p className="truncate text-sm text-ink">{submission.caption}</p>}
        {submission.clipUrl && (
          <a href={submission.clipUrl} target="_blank" rel="noopener noreferrer" className="text-eyebrow text-xs text-blue-500 hover:underline">
            Watch clip ↗
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Point of the Month es la ÚNICA categoría de premios con envío público — vive en
 * /account, no en la página pública de /awards (subir/seguir tu propio clip es una
 * acción personal como reclamar tu perfil o subir un MatchLog, no algo que la página
 * pública de votación tenga que enseñar). Puede haber hasta
 * MAX_PENDING_SUBMISSIONS_PER_PERIOD envíos pendientes a la vez (app/awards/
 * actions.ts) — se enseñan todos, y el formulario sigue disponible para añadir otro
 * mientras no se llegue al tope (el propio servidor es quien de verdad lo hace
 * cumplir, esto es solo la UI).
 */
export function PointOfMonthSubmitForm({ initialPending }: { initialPending: MyPendingSubmission[] }) {
  const [pending, setPending] = useState(initialPending);
  const [clipUrl, setClipUrl] = useState("");
  const [match, setMatch] = useState<MatchCandidateOption | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clipUrl.trim()) {
      setError("Paste a link to your clip first.");
      return;
    }
    if (!match) {
      setError("Pick which match this point was from.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("clipUrl", clipUrl.trim());
    formData.set("matchId", String(match.id));
    if (caption.trim()) formData.set("caption", caption.trim());

    startTransition(async () => {
      const { error } = await submitPointOfMonthClip(formData);
      if (error) {
        setError(error);
        return;
      }
      setPending((prev) => [{ id: -Date.now(), caption: caption.trim() || null, clipUrl: clipUrl.trim(), createdAt: new Date() }, ...prev]);
      setClipUrl("");
      setMatch(null);
      setCaption("");
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-label text-sm">
        Made a point you&rsquo;re proud of this month? Upload the replay somewhere (YouTube, Google Drive, wherever) and paste the link
        here to nominate it for Point of the Month — an admin reviews every submission before it goes to a vote.
      </p>

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((s) => (
            <PendingSubmissionRow key={s.id} submission={s} />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Clip link</span>
          <input
            type="url"
            value={clipUrl}
            onChange={(e) => setClipUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </div>
        <div>
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Which match was this from?</span>
          <MatchPicker value={match} onChange={setMatch} />
        </div>
        <div>
          <span className="text-eyebrow mb-1 block text-xs text-muted-label">Note (optional)</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What made this point special?" className={inputClass} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!clipUrl.trim() || !match || isPending}
            className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Submitting…" : "Submit for review"}
          </button>
          {error && <p className="text-down text-xs">{error}</p>}
        </div>
      </form>
    </div>
  );
}
