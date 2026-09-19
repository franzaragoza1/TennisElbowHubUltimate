"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTopic } from "@/app/discussions/actions";

export function NewTopicForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error, slug } = await createTopic(formData);
      if (error || !slug) {
        setError(error ?? "Something went wrong — try again.");
        return;
      }
      router.push(`/discussions/${slug}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="title" className="text-eyebrow mb-1.5 block text-[10px] text-muted-label">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="What do you want to talk about?"
          className="w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        />
      </div>
      <div>
        <label htmlFor="body" className="text-eyebrow mb-1.5 block text-[10px] text-muted-label">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={8}
          maxLength={5000}
          placeholder="Get the conversation started…"
          className="w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Posting…" : "Post topic"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
