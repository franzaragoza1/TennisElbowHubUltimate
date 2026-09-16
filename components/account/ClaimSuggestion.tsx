"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestPlayerClaim, confirmPendingLink, rejectPendingLink, type SuggestedClaimMatch } from "@/app/account/actions";
import { ClaimPlayerSearch } from "./ClaimPlayerSearch";

/**
 * Pedido explícito: al iniciar sesión, intentar encontrar el perfil solo/a y preguntar
 * "Is this your profile?" antes que nada, como un POP UP de verdad — no una tarjeta más
 * entre el resto del contenido, algo que se pueda pasar por alto sin querer. El
 * buscador manual de siempre (ClaimPlayerSearch) solo aparece si no hay sugerencia
 * (`suggestion` null) o si la persona dice que no es ella — nunca los dos a la vez.
 *
 * `source` decide qué hace cada botón — mismo pop-up para las dos sugerencias
 * posibles (pedido explícito, 2026-09-16: sin distinción visible para quien lo ve):
 * "self" es la autosugerencia por nombre de siempre (getSuggestedClaimMatch) — decir
 * que sí sigue quedando 'pending' hasta que un admin lo apruebe. "admin" es una
 * propuesta que un admin ya revisó (getPendingAdminLinkSuggestion) — decir que sí
 * vincula YA MISMO, decir que no de verdad limpia la propuesta en la base de datos
 * (a diferencia de "self", donde un "no" nunca llegó a crear nada que deshacer).
 */
export function ClaimSuggestion({ suggestion, source = "self" }: { suggestion: SuggestedClaimMatch | null; source?: "self" | "admin" }) {
  const [dismissed, setDismissed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const showModal = !!suggestion && !dismissed && !requested;

  useEffect(() => {
    if (!showModal) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDismissed(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

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
      if (source === "admin") {
        await confirmPendingLink(player.id);
        // A diferencia de "self" (que solo cambia a un mensaje de "pending" dentro del
        // mismo árbol), esto vincula de verdad — la página entera tiene que volver a
        // pedir datos al servidor para dejar de enseñar la pantalla de "claim your
        // profile" y pasar al panel normal del jugador ya vinculado.
        router.refresh();
        return;
      }
      await requestPlayerClaim(player.id);
      setRequested(true);
    });
  }

  function handleNo() {
    if (source === "admin") {
      startTransition(async () => {
        await rejectPendingLink(player.id);
        setDismissed(true);
      });
      return;
    }
    setDismissed(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 p-4 backdrop-blur-sm"
      onClick={() => setDismissed(true)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-suggestion-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-rule bg-paper p-5 shadow-2xl"
      >
        <p id="claim-suggestion-title" className="text-ink text-sm">
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
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            autoFocus
            disabled={isPending}
            onClick={handleYes}
            className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Yes, that's me"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleNo}
            className="text-eyebrow rounded-full border border-rule px-5 py-2 text-xs text-muted-label hover:bg-paper-tint disabled:cursor-not-allowed disabled:opacity-50"
          >
            No, that&apos;s not me
          </button>
        </div>
      </div>
    </div>
  );
}
