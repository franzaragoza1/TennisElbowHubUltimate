"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteComment } from "@/app/news/[slug]/actions";

export function DeleteCommentButton({ commentId, slug }: { commentId: number; slug: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await deleteComment(commentId, slug);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Delete comment"
      className="tap-scale flex items-center gap-1 text-xs text-muted-label hover:text-down disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      Delete
    </button>
  );
}
