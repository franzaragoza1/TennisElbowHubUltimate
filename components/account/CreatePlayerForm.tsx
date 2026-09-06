"use client";

import { useTransition } from "react";
import { createLinkedPlayer } from "@/app/account/actions";

export function CreatePlayerForm() {
  const [isPending, startTransition] = useTransition();
  const currentYear = new Date().getFullYear();

  function handleSubmit(formData: FormData) {
    startTransition(() => createLinkedPlayer(formData));
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-rule bg-paper p-4">
      <label className="block">
        <span className="text-eyebrow mb-1 block text-xs text-muted-label">Display name</span>
        <input
          type="text"
          name="displayName"
          required
          className="w-full rounded border border-rule px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="block">
        <span className="text-eyebrow mb-1 block text-xs text-muted-label">Start year</span>
        <input
          type="number"
          name="startYear"
          required
          defaultValue={currentYear}
          min={2021}
          max={currentYear}
          className="w-32 rounded border border-rule px-3 py-2 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="text-eyebrow self-start rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create profile"}
      </button>
    </form>
  );
}
