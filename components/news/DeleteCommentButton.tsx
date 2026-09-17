"use client";

import { useTransition } from "react";
import { deleteComment } from "@/app/news/[slug]/actions";

export function DeleteCommentButton({ commentId, slug }: { commentId: number; slug: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await deleteComment(commentId, slug);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="text-eyebrow shrink-0 text-xs text-down hover:underline disabled:opacity-50">
      Delete
    </button>
  );
}
