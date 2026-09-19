"use client";

import { useState, useTransition } from "react";
import { updateMemberBio } from "@/app/account/actions";

/** Edición de authUsers.bio — la única cosa "de perfil" propia que tiene una cuenta sin
 * jugador del tour vinculado todavía (ver lib/memberProfile.ts). Mismo patrón
 * useTransition + FormData a mano de siempre en este proyecto (CommentForm,
 * NewTopicForm...), para poder enseñar el error o el "Saved" inline sin recargar. */
export function MemberBioForm({ initialBio }: { initialBio: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error } = await updateMemberBio(formData);
      if (error) setError(error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="bio" className="text-eyebrow mb-1.5 block text-[10px] text-muted-label">
        Bio
      </label>
      <textarea
        id="bio"
        name="bio"
        rows={3}
        maxLength={500}
        defaultValue={initialBio ?? ""}
        placeholder="Say something about yourself — this shows on your profile."
        className="w-full rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && !error && <p className="text-up text-xs">Saved.</p>}
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
