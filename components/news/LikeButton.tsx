"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";

/** Genérico — lo usa tanto el artículo como cada comentario/respuesta. `toggleAction`
 * llega ya con sus argumentos aplicados (`toggleNewsLike.bind(null, newsId, slug)` o
 * `toggleCommentLike.bind(null, commentId, slug)`) — un Server Action enlazado puede
 * pasarse como prop desde un Server Component sin más ceremonia. */
export function LikeButton({
  initialCount,
  initialLiked,
  toggleAction,
}: {
  initialCount: number;
  initialLiked: boolean;
  toggleAction: () => Promise<{ count: number; liked: boolean }>;
}) {
  const [state, setState] = useState({ count: initialCount, liked: initialLiked });
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleAction();
      setState(result);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`tap-scale flex items-center gap-1.5 text-xs disabled:opacity-50 ${state.liked ? "text-down" : "text-muted-label hover:text-down"}`}
    >
      <Heart className="h-4 w-4" fill={state.liked ? "currentColor" : "none"} aria-hidden="true" />
      <span className="tour-numeric">{state.count}</span>
    </button>
  );
}
