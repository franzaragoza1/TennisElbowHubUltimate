"use client";

import { useRef, useState, useTransition } from "react";
import { postTopicComment } from "@/app/discussions/actions";

export function TopicCommentForm({
  topicId,
  slug,
  parentId,
  compact = false,
  autoFocus = false,
  onPosted,
}: {
  topicId: number;
  slug: string;
  parentId?: number;
  compact?: boolean;
  autoFocus?: boolean;
  onPosted?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error } = await postTopicComment(topicId, slug, formData);
      if (error) {
        setError(error);
        return;
      }
      formRef.current?.reset();
      onPosted?.();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={compact ? "mt-2" : "mb-6"}>
      {parentId !== undefined && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="body"
        required
        rows={compact ? 2 : 3}
        maxLength={1000}
        autoFocus={autoFocus}
        placeholder={compact ? "Write a reply…" : "Join the conversation…"}
        className="w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Posting…" : compact ? "Post reply" : "Post reply"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
