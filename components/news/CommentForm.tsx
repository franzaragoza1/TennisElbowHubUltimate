"use client";

import { useRef, useState, useTransition } from "react";
import { postComment } from "@/app/news/[slug]/actions";

export function CommentForm({ newsId, slug }: { newsId: number; slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error } = await postComment(newsId, slug, formData);
      if (error) {
        setError(error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mb-6">
      <textarea
        name="body"
        required
        rows={3}
        maxLength={1000}
        placeholder="Join the conversation…"
        className="w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Posting…" : "Post comment"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
