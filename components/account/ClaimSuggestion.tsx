"use client";

import { useState, useTransition } from "react";
import { requestPlayerClaim, type SuggestedClaimMatch } from "@/app/account/actions";
import { ClaimPlayerSearch } from "./ClaimPlayerSearch";

/**
 * Pedido explícito: al iniciar sesión, intentar encontrar el perfil solo/a y preguntar
 * "Is this your profile?" antes que nada — el buscador manual de siempre
 * (ClaimPlayerSearch) solo aparece si no hay sugerencia (`suggestion` null, ver
 * getSuggestedClaimMatch en app/account/actions.ts) o si la persona dice que no es
 * ella. Decir que sí dispara el mismo `requestPlayerClaim` de siempre — sigue
 * quedando 'pending' hasta que un admin lo apruebe, nunca se vincula solo.
 */
export function ClaimSuggestion({ suggestion }: { suggestion: SuggestedClaimMatch | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!suggestion || dismissed) return <ClaimPlayerSearch />;
  const player = suggestion;

  if (requested) {
    return (
      <p className="text-muted-label rounded-lg border border-rule bg-paper-tint px-4 py-3 text-sm">
        Request sent — an admin needs to approve it before this profile is linked to your account.
      </p>
    );
  }

  function handleYes() {
    startTransition(async () => {
      await requestPlayerClaim(player.id);
      setRequested(true);
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-tint p-4">
      <p className="text-ink text-sm">
        Is this your profile? <span className="text-headline">{player.displayName}</span>
        {player.country && <span className="text-muted-label"> · {player.country}</span>}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 border-y border-rule py-3">
        <div>
          <p className="text-eyebrow text-[10px] text-muted-label">Current rank</p>
          <p className="tour-numeric text-headline text-sm text-ink">{player.currentRank ? `#${player.currentRank}` : "—"}</p>
        </div>
        <div>
          <p className="text-eyebrow text-[10px] text-muted-label">Career W-L</p>
          <p className="tour-numeric text-headline text-sm text-ink">
            {player.careerWins}-{player.careerLosses}
          </p>
        </div>
        <div>
          <p className="text-eyebrow text-[10px] text-muted-label">Titles</p>
          <p className="tour-numeric text-headline text-sm text-ink">{player.careerTitles}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleYes}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Yes, that's me"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setDismissed(true)}
          className="text-eyebrow rounded-full border border-rule px-5 py-2 text-xs text-muted-label hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          No, that&apos;s not me
        </button>
      </div>
    </div>
  );
}
