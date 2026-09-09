"use client";

import { useState, useTransition } from "react";
import { submitReporterStory } from "@/app/account/actions";
import { Field, PlayerTagger, inputClass, type TagOption, type EditionOption } from "@/components/admin/NewsForm";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { NEWS_CATEGORIES } from "@/lib/newsCategories";

/**
 * Formulario de un reportero aprobado — mismos campos que NewsForm (admin), MENOS el
 * checkbox de "Published" (siempre nace en borrador, ver app/account/actions.ts::
 * submitReporterStory) y sin el botón de "Generate AI drafts" que sí tiene
 * NewsSection — pedido explícito del propietario: un reportero nunca genera
 * borradores por IA, solo escribe a mano.
 */
export function ReporterStoryForm({ players, editions, onSubmitted }: { players: TagOption[]; editions: EditionOption[]; onSubmitted: () => void }) {
  const [tagged, setTagged] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const { error } = await submitReporterStory(formData);
      if (error) {
        setError(error);
        return;
      }
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      setTagged([]);
      onSubmitted();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {success && (
        <p className="text-up rounded-lg border border-up/30 bg-up/10 px-4 py-2 text-sm">
          Submitted — an admin will review it before it goes live.
        </p>
      )}

      <Field label="Headline">
        <input name="title" required className={inputClass} />
      </Field>

      <Field label="Standfirst" hint="One or two lines. This is what shows on the home page card.">
        <textarea name="excerpt" required rows={2} className={inputClass} />
      </Field>

      <Field label="Body">
        <RichTextEditor name="body" initialContent="" placeholder="Write the story…" />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Category">
          <select name="category" defaultValue="REPORT" className={inputClass}>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tournament" hint="Optional. Colours the card with the court surface.">
          <select name="editionId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Image URL" hint="Optional. Left empty, the card falls back to a colour block.">
        <input name="imageUrl" type="url" placeholder="https://…" className={inputClass} />
      </Field>

      <PlayerTagger players={players} selected={tagged} onChange={setTagged} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit for review"}
        </button>
        {error && <p className="text-down text-xs">{error}</p>}
      </div>
    </form>
  );
}
