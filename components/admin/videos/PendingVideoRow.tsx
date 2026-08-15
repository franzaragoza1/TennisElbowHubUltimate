"use client";

import { useEffect, useState, useTransition } from "react";
import {
  confirmMatchVideo,
  getMatchesForEditionBrowse,
  getMatchLabels,
  rejectMatchVideo,
  searchEditionsForBrowse,
  searchMatchCandidates,
  type EditionOption,
  type MatchCandidateOption,
} from "@/app/admin/videos/actions";

export interface PendingVideo {
  id: number;
  title: string;
  matchConfidence: string | null;
  candidateMatchIds: number[];
}

type Mode = "candidates" | "search" | "browse";

export function PendingVideoRow({ video }: { video: PendingVideo }) {
  const hasCandidates = video.candidateMatchIds.length > 0;
  const [mode, setMode] = useState<Mode>(hasCandidates ? "candidates" : "search");

  const [candidateOptions, setCandidateOptions] = useState<MatchCandidateOption[]>([]);
  const [query, setQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<MatchCandidateOption[]>([]);
  const [editionQuery, setEditionQuery] = useState("");
  const [editionOptions, setEditionOptions] = useState<EditionOption[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<EditionOption | null>(null);
  const [editionMatches, setEditionMatches] = useState<MatchCandidateOption[]>([]);
  const [selected, setSelected] = useState<MatchCandidateOption | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!hasCandidates) return;
    startTransition(async () => {
      setCandidateOptions(await getMatchLabels(video.candidateMatchIds));
    });
    // solo hace falta una vez por vídeo — la lista de candidatos no cambia en cliente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  function handleSearchQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setSearchOptions([]);
      return;
    }
    startTransition(async () => {
      setSearchOptions(await searchMatchCandidates(value));
    });
  }

  function handleEditionQueryChange(value: string) {
    setEditionQuery(value);
    setSelectedEdition(null);
    setEditionMatches([]);
    if (value.trim().length < 2) {
      setEditionOptions([]);
      return;
    }
    startTransition(async () => {
      setEditionOptions(await searchEditionsForBrowse(value));
    });
  }

  function pickEdition(edition: EditionOption) {
    setSelectedEdition(edition);
    setEditionOptions([]);
    startTransition(async () => {
      setEditionMatches(await getMatchesForEditionBrowse(edition.id));
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <p className="text-headline text-sm text-ink">{video.title}</p>
      {video.matchConfidence && <p className="text-muted-label mt-1 text-xs">{video.matchConfidence}</p>}

      <div className="mt-3">
        {selected ? (
          <div className="flex items-center gap-2 rounded-lg border border-rule bg-paper-tint px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{selected.label}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex gap-3 border-b border-rule text-xs">
              {hasCandidates && (
                <button
                  type="button"
                  onClick={() => setMode("candidates")}
                  className={`text-eyebrow border-b-2 pb-1.5 ${mode === "candidates" ? "border-blue-500 text-ink" : "border-transparent text-muted-label hover:text-ink"}`}
                >
                  Suggested
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("search")}
                className={`text-eyebrow border-b-2 pb-1.5 ${mode === "search" ? "border-blue-500 text-ink" : "border-transparent text-muted-label hover:text-ink"}`}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setMode("browse")}
                className={`text-eyebrow border-b-2 pb-1.5 ${mode === "browse" ? "border-blue-500 text-ink" : "border-transparent text-muted-label hover:text-ink"}`}
              >
                Browse tournament
              </button>
            </div>

            {mode === "candidates" && (
              // El título ya se resolvió a dos rivales conocidos: solo se ofrecen los
              // partidos ya jugados entre ellos, nunca una búsqueda abierta.
              <ul className="overflow-hidden rounded-lg border border-rule">
                {candidateOptions.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => setSelected(o)} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint">
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {mode === "search" && (
              <>
                <input
                  value={query}
                  onChange={(e) => handleSearchQueryChange(e.target.value)}
                  placeholder="Search by player or tournament…"
                  className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
                />
                {searchOptions.length > 0 && (
                  <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
                    {searchOptions.map((o) => (
                      <li key={o.id}>
                        <button type="button" onClick={() => setSelected(o)} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint">
                          {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {mode === "browse" &&
              (selectedEdition ? (
                <div>
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-rule bg-paper-tint px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{selectedEdition.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEdition(null);
                        setEditionMatches([]);
                      }}
                      className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline"
                    >
                      Change tournament
                    </button>
                  </div>
                  <ul className="max-h-64 overflow-y-auto rounded-lg border border-rule">
                    {editionMatches.map((o) => (
                      <li key={o.id}>
                        <button type="button" onClick={() => setSelected(o)} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint">
                          {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <input
                    value={editionQuery}
                    onChange={(e) => handleEditionQueryChange(e.target.value)}
                    placeholder="Search for the tournament…"
                    className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
                  />
                  {editionOptions.length > 0 && (
                    <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
                      {editionOptions.map((o) => (
                        <li key={o.id}>
                          <button type="button" onClick={() => pickEdition(o)} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint">
                            {o.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ))}
          </>
        )}
      </div>

      <div className="mt-3 flex gap-3">
        <form action={confirmMatchVideo}>
          <input type="hidden" name="videoId" value={video.id} />
          <input type="hidden" name="matchId" value={selected?.id ?? ""} />
          <button
            type="submit"
            disabled={!selected}
            className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm
          </button>
        </form>
        <form action={rejectMatchVideo}>
          <input type="hidden" name="videoId" value={video.id} />
          <button type="submit" className="text-eyebrow rounded-full border border-down px-4 py-1.5 text-xs text-down hover:bg-down/10">
            Reject
          </button>
        </form>
      </div>
    </div>
  );
}
