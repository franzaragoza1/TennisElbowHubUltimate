"use client";

import { useState, useTransition } from "react";
import { swapParticipantGroups } from "@/app/admin/finals/actions";

export interface AssignmentParticipant {
  id: number;
  displayName: string;
  seed: number;
  group: "A" | "B";
}

/**
 * Drag & drop de reparto de grupos: solo deja intercambiar a los dos jugadores de un
 * mismo escalón de seed (1-2, 3-4, 5-6, 7-8), así que cada fila es su propia zona de
 * arrastre — nunca hay una casilla de destino fuera de la fila de origen. La regla se
 * repite en `swapParticipantGroups` en el servidor, esto es solo para no dejar
 * arrastrar donde no toca.
 */
export function GroupAssignmentBoard({
  participants,
  locked,
}: {
  participants: AssignmentParticipant[];
  locked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<AssignmentParticipant | null>(null);

  const tiers = [1, 2, 3, 4]
    .map((tier) => participants.filter((p) => Math.ceil(p.seed / 2) === tier).sort((a, b) => a.seed - b.seed));

  function handleDrop(target: AssignmentParticipant) {
    if (!dragged || dragged.id === target.id) return;
    setError(null);
    const from = dragged;
    setDragged(null);
    startTransition(async () => {
      const result = await swapParticipantGroups(from.id, target.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-down">{error}</p>}
      <div className={`overflow-hidden rounded-lg border border-rule bg-paper shadow-sm ${isPending ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-2 border-b border-rule bg-paper-tint">
          <p className="text-eyebrow px-3 py-2 text-xs text-muted-label">Group A</p>
          <p className="text-eyebrow px-3 py-2 text-xs text-muted-label">Group B</p>
        </div>
        {tiers.map((tier, i) => (
          <div key={i} className={`grid grid-cols-2 ${i > 0 ? "border-t border-rule" : ""}`}>
            {(["A", "B"] as const).map((group) => {
              const player = tier.find((p) => p.group === group);
              if (!player) return <div key={group} className="p-3" />;
              return (
                <div
                  key={group}
                  draggable={!locked}
                  onDragStart={() => setDragged(player)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(player)}
                  className={`flex items-center gap-2 p-3 ${locked ? "" : "cursor-grab active:cursor-grabbing"}`}
                >
                  <span className="text-eyebrow w-6 shrink-0 text-xs text-muted-label">#{player.seed}</span>
                  <span className="text-headline truncate text-sm text-ink">{player.displayName}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {!locked && (
        <p className="text-muted-label mt-2 text-xs">
          Drag a player onto their seed-tier partner (same row) to swap them between groups.
        </p>
      )}
    </div>
  );
}
