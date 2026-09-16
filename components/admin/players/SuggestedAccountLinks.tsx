"use client";

import { useState, useTransition } from "react";
import { getSuggestedAccountLinks, confirmAccountLink } from "@/app/admin/players/linking/actions";
import type { SuggestedAccountLink } from "@/lib/adminLinkSuggestions";

/**
 * Herramienta bajo demanda (pedido explícito, 2026-09-16) — nunca corre sola al abrir
 * la página: cuentas con Discord vinculado que nunca reclamaron ningún jugador,
 * emparejadas por IA contra jugadores todavía sin dueño (lib/adminLinkSuggestions.ts).
 * Confirmar aquí NO vincula ya mismo — pone `players.pendingLinkUserId`, y hace falta
 * que el propio jugador diga "sí, soy yo" la próxima vez que entre (mismo pop-up
 * "Is this your profile?" de siempre) antes de que cuente como vinculado de verdad.
 */
export function SuggestedAccountLinks() {
  const [suggestions, setSuggestions] = useState<SuggestedAccountLink[] | null>(null);
  const [isSearching, startSearching] = useTransition();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [confirmedKeys, setConfirmedKeys] = useState<Set<string>>(new Set());

  function handleFindMatches() {
    startSearching(async () => {
      setSuggestions(await getSuggestedAccountLinks());
    });
  }

  function handleConfirm(s: SuggestedAccountLink) {
    const key = `${s.userId}:${s.playerId}`;
    setConfirmingKey(key);
    confirmAccountLink(s.userId, s.playerId).then(() => {
      setConfirmedKeys((prev) => new Set(prev).add(key));
      setConfirmingKey(null);
    });
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-headline text-lg text-ink">Suggested account links</h2>
          <p className="text-muted-label text-xs">
            Discord accounts that signed in but never claimed a profile, matched by AI against unclaimed players.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFindMatches}
          disabled={isSearching}
          className="text-eyebrow shrink-0 rounded-full border border-rule px-5 py-2.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? "Looking…" : "Find matches"}
        </button>
      </div>

      {suggestions !== null && (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {suggestions.length === 0 ? (
            <p className="text-muted-label px-4 py-8 text-center text-sm">No confident matches found.</p>
          ) : (
            suggestions.map((s) => {
              const key = `${s.userId}:${s.playerId}`;
              const confirmed = confirmedKeys.has(key);
              return (
                <div key={key} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    {s.discordImage && (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Discord
                      <img src={s.discordImage} alt="" className="h-8 w-8 shrink-0 rounded-full" />
                    )}
                    <p className="text-ink truncate">
                      {s.discordName} <span className="text-muted-label">↔</span> {s.playerDisplayName}
                    </p>
                  </div>
                  {confirmed ? (
                    <span className="text-eyebrow shrink-0 text-xs text-up">Proposed</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConfirm(s)}
                      disabled={confirmingKey === key}
                      className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirmingKey === key ? "Proposing…" : "Confirm"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
