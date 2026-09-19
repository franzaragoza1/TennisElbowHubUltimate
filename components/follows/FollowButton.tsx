"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Check } from "lucide-react";
import { getMyFollowState } from "@/app/follows/actions";
import type { FollowTargetType } from "@/lib/follows";

/** Mismo patrón que components/news/LikeButton.tsx — `toggleAction` llega ya con sus
 * argumentos aplicados (`toggleFollow.bind(null, "player", playerId, path)`), un Server
 * Action enlazado se pasa como prop desde un Server Component sin más ceremonia.
 *
 * `initialFollowing` es OPCIONAL a propósito: en una página completamente dinámica
 * (p.ej. /players/[id], que ya lee `searchParams`) el propio Server Component la
 * resuelve fuera de cualquier caché y la pasa aquí. En una página estática/ISR
 * compartida entre visitantes (app/tournaments/[id]/page.tsx, `generateStaticParams` +
 * `revalidate`) NUNCA se puede calcular ahí sin filtrar el estado de una persona a
 * todas las demás — se omite `initialFollowing` y este componente pide el suyo propio
 * al montar (`getMyFollowState`), mismo motivo/patrón ya usado por
 * components/tournament/NextOpponentPanel.tsx. */
export function FollowButton({
  targetType,
  targetId,
  initialFollowing,
  toggleAction,
  onDarkSurface = false,
}: {
  targetType: FollowTargetType;
  targetId: number;
  initialFollowing?: boolean;
  toggleAction: () => Promise<{ following: boolean }>;
  onDarkSurface?: boolean;
}) {
  const [following, setFollowing] = useState<boolean | null>(initialFollowing ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialFollowing !== undefined) return;
    let cancelled = false;
    getMyFollowState(targetType, targetId).then((result) => {
      if (!cancelled) setFollowing(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, mismo criterio que NextOpponentPanel.tsx
  }, []);

  function handleClick() {
    startTransition(async () => {
      const result = await toggleAction();
      setFollowing(result.following);
    });
  }

  // Primer render sin `following` resuelto todavía (solo en el modo "pídelo tú
  // mismo") — un instante en blanco es preferible a mostrar "Follow" y que salte a
  // "Following" en cuanto llega la respuesta, mismo criterio que otros relojes/estados
  // en vivo de este sitio (ver NextOpponentPanel.tsx::RemainingTime).
  if (following === null) return <span className="inline-block h-8 w-24" aria-hidden="true" />;

  const base = "tap-scale text-eyebrow flex items-center gap-1.5 rounded-full px-4 py-2 text-xs disabled:opacity-50";
  const activeClass = following
    ? onDarkSurface
      ? "bg-white/10 text-accent-500"
      : "bg-navy-900 text-white"
    : onDarkSurface
      ? "border border-white/20 text-white/70 hover:border-white/40 hover:text-white"
      : "border border-rule text-muted-label hover:border-blue-500 hover:text-blue-500";

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={`${base} ${activeClass}`}>
      {following ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
