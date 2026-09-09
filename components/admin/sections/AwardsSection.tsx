"use client";

import { useEffect, useState, useTransition } from "react";
import {
  closeVoting,
  deleteAwardPeriod,
  getAwardPeriodDetail,
  openVoting,
  updateAwardPeriodSpeech,
  type AwardPeriodDetail,
} from "@/app/admin/awards/actions";
import { AddNomineeForm, type PlayerOption } from "@/components/admin/awards/AddNomineeForm";
import { DeleteNominationButton } from "@/components/admin/awards/DeleteNominationButton";
import { NewAwardPeriodForm } from "@/components/admin/awards/NewAwardPeriodForm";
import { PendingSubmissionButtons } from "@/components/admin/awards/PendingSubmissionButtons";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { categoriesForCycle } from "@/lib/awards/catalog";
import { periodLabel } from "@/lib/awards/format";
import type { AwardPeriodRow } from "@/lib/awards/queries";
import type { DiscordRoleOption } from "@/lib/discordBot/guildRoles";
import { sanitizeRichText, toEditorContent } from "@/lib/richText";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", voting: "Voting open", closed: "Closed" };

/** Ficha de UN período — pedida bajo demanda y re-pedida tras cada mutación, mismo
 * patrón que FinalsDetail (components/admin/sections/FinalsSection.tsx): no hay ruta
 * de servidor real que Next.js pueda revalidar sola para un detalle client-fetched. */
function AwardPeriodDetailView({
  periodId,
  players,
  discordRoles,
  onBack,
  onDeleted,
}: {
  periodId: number;
  players: PlayerOption[];
  discordRoles: DiscordRoleOption[];
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<AwardPeriodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSavingSpeech, startSavingSpeech] = useTransition();
  const [isTogglingVoting, startTogglingVoting] = useTransition();

  function refetch() {
    startLoading(async () => {
      setDetail(await getAwardPeriodDetail(periodId));
    });
  }

  useEffect(refetch, [periodId]);

  function handleDelete() {
    if (!confirm("Delete this awards period? This removes every nominee and vote in it. This can't be undone.")) return;
    startLoading(async () => {
      const formData = new FormData();
      formData.set("periodId", String(periodId));
      await deleteAwardPeriod(formData);
      onDeleted();
    });
  }

  function handleSaveSpeech(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSavingSpeech(async () => {
      await updateAwardPeriodSpeech(formData);
      refetch();
    });
  }

  if (!detail) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-eyebrow mb-4 text-xs text-muted-label hover:text-ink">
          ← Back to Awards
        </button>
        <p className="text-muted-label text-sm">{isLoading ? "Loading…" : "Period not found."}</p>
      </div>
    );
  }

  const categories = categoriesForCycle(detail.cycle as "monthly" | "yearly");

  function runOpenVoting() {
    setError(null);
    startTogglingVoting(async () => {
      const formData = new FormData();
      formData.set("periodId", String(periodId));
      const { error } = await openVoting(formData);
      if (error) {
        setError(error);
        return;
      }
      refetch();
    });
  }

  function runCloseVoting() {
    setError(null);
    startTogglingVoting(async () => {
      const formData = new FormData();
      formData.set("periodId", String(periodId));
      const { error } = await closeVoting(formData);
      if (error) {
        setError(error);
        return;
      }
      refetch();
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onBack} className="text-eyebrow mb-2 block text-xs text-muted-label hover:text-ink">
            ← Back to Awards
          </button>
          <h1 className="text-headline text-2xl text-ink">{periodLabel(detail)}</h1>
          <p className="text-muted-label mb-3 text-xs">{STATUS_LABEL[detail.status] ?? detail.status}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {detail.status !== "draft" && (
            <a href={`/awards/${detail.id}`} target="_blank" rel="noopener noreferrer" className="text-eyebrow text-xs text-blue-500 hover:underline">
              View public page
            </a>
          )}
          <button type="button" onClick={handleDelete} className="text-eyebrow text-xs text-down hover:underline">
            Delete
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down">{error}</p>}

      <section className="mb-8">
        <h2 className="text-headline mb-2 text-lg text-ink">Announcement speech</h2>
        {detail.status === "draft" ? (
          <form onSubmit={handleSaveSpeech} className="space-y-2">
            <input type="hidden" name="periodId" value={periodId} />
            <RichTextEditor
              name="speech"
              initialContent={detail.speech ?? ""}
              placeholder="Write the announcement — this is what the site (and later the Discord bot) shows for this period."
              mentionOptions={discordRoles}
            />
            <button
              type="submit"
              disabled={isSavingSpeech}
              className="text-eyebrow rounded-full border border-rule px-4 py-1.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500 disabled:opacity-50"
            >
              {isSavingSpeech ? "Saving…" : "Save speech"}
            </button>
          </form>
        ) : detail.speech ? (
          <div className="rich-text rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink" dangerouslySetInnerHTML={{ __html: sanitizeRichText(toEditorContent(detail.speech)) }} />
        ) : (
          <p className="text-muted-label text-sm italic">No speech written.</p>
        )}
      </section>

      {categories.map((category) => {
        const nominees = detail.nominationsByCategory[category.key] ?? [];
        return (
          <section key={category.key} className="mb-6">
            <h3 className="text-headline mb-2 text-sm text-ink">
              {category.emoji} {category.label}
            </h3>
            {nominees.length === 0 ? (
              <p className="text-muted-label text-xs italic">No nominees yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-rule bg-paper">
                {nominees.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 border-b border-rule px-4 py-2.5 last:border-0">
                    <span className="text-eyebrow shrink-0 rounded-full bg-muted-label/10 px-2 py-0.5 text-[10px] text-muted-label">{n.status}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {n.playerName ?? ""}
                        {n.playerName && n.matchLabel ? " — " : ""}
                        {n.matchLabel ?? ""}
                      </p>
                      {n.caption && <p className="text-muted-label truncate text-xs">{n.caption}</p>}
                      {n.clipUrl && (
                        <a href={n.clipUrl} target="_blank" rel="noopener noreferrer" className="text-eyebrow text-xs text-blue-500 hover:underline">
                          Watch clip ↗
                        </a>
                      )}
                    </div>
                    {n.status === "pending" ? (
                      <PendingSubmissionButtons nominationId={n.id} onDone={refetch} />
                    ) : detail.status !== "draft" ? (
                      <span className="tour-numeric text-headline shrink-0 text-sm text-ink">{n.voteCount} votes</span>
                    ) : (
                      <DeleteNominationButton nominationId={n.id} onRemoved={refetch} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {detail.status === "draft" && (
        <section className="mb-8">
          <h2 className="text-headline mb-2 text-lg text-ink">Add a nominee</h2>
          <AddNomineeForm periodId={detail.id} cycle={detail.cycle as "monthly" | "yearly"} players={players} onAdded={refetch} />
        </section>
      )}

      <div className="flex items-center gap-3">
        {detail.status === "draft" && (
          <button
            type="button"
            onClick={runOpenVoting}
            disabled={isTogglingVoting}
            className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {isTogglingVoting ? "Opening…" : "Open voting"}
          </button>
        )}
        {detail.status === "voting" && (
          <div>
            <button
              type="button"
              onClick={runCloseVoting}
              disabled={isTogglingVoting}
              className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {isTogglingVoting ? "Ending…" : "End voting on Discord now"}
            </button>
            <p className="text-muted-label mt-2 text-xs">
              The vote happens on Discord, not here. Clicking this ends the poll(s) and closes this period right away in most cases; otherwise the bot picks up the final
              count within a minute. Left alone, the poll(s) close on their own after 7 days instead.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Lista de períodos de premios + alta de uno nuevo — mismo patrón que FinalsSection. */
export function AwardsSection({ periods, players, discordRoles }: { periods: AwardPeriodRow[]; players: PlayerOption[]; discordRoles: DiscordRoleOption[] }) {
  const [view, setView] = useState<{ mode: "list" } | { mode: "new" } | { mode: "detail"; id: number }>({ mode: "list" });

  if (view.mode === "detail") {
    return (
      <AwardPeriodDetailView
        periodId={view.id}
        players={players}
        discordRoles={discordRoles}
        onBack={() => setView({ mode: "list" })}
        onDeleted={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "new") {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-headline text-2xl text-ink">New awards period</h1>
          <button type="button" onClick={() => setView({ mode: "list" })} className="text-eyebrow text-xs text-muted-label hover:text-ink">
            ← Back to list
          </button>
        </div>
        <NewAwardPeriodForm onCreated={(periodId) => setView({ mode: "detail", id: periodId })} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-headline text-2xl text-ink">Awards</h1>
        <button
          type="button"
          onClick={() => setView({ mode: "new" })}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800"
        >
          New period
        </button>
      </div>

      {periods.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">No awards periods yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {periods.map((p) => (
            <div key={p.id} className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-0">
              <span className="text-eyebrow shrink-0 rounded-full bg-muted-label/10 px-2.5 py-1 text-[10px] text-muted-label">
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-headline truncate text-ink">{periodLabel(p)}</p>
              </div>
              <button type="button" onClick={() => setView({ mode: "detail", id: p.id })} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
                Manage
              </button>
              {p.status !== "draft" && (
                <a href={`/awards/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-eyebrow shrink-0 text-xs text-muted-label hover:underline">
                  View
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
