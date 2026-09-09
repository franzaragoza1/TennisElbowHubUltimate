"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getFinalsEditionDetail,
  startGroupStage,
  updateFinalsEditionInfo,
  type FinalsEditionDetail,
} from "@/app/admin/finals/actions";
import { GroupAssignmentBoard } from "@/components/finals/GroupAssignmentBoard";
import { GroupStandingsTable } from "@/components/finals/GroupStandingsTable";
import { MatchResultForm } from "@/components/admin/finals/MatchResultForm";
import { QuickInputPanel } from "@/components/admin/finals/QuickInputPanel";
import { AlternateSubstitutionForm } from "@/components/admin/finals/AlternateSubstitutionForm";
import { DeleteFinalsEditionButton } from "@/components/admin/finals/DeleteFinalsEditionButton";
import { NewFinalsEditionForm, type PlayerOption } from "@/components/admin/finals/NewFinalsEditionForm";

export interface FinalsEditionListRow {
  id: number;
  displayName: string;
  status: string;
  kind: string;
  year: number;
}

const STATUS_LABEL: Record<string, string> = {
  setup: "Setting up",
  groups: "Group stage",
  knockout: "Knockout stage",
  completed: "Completed",
};

/** Ficha de UNA edición — antes app/admin/(panel)/finals/[id]/page.tsx. A diferencia
 * de News/Players, este detalle NUNCA llega como prop del servidor (demasiadas
 * consultas para traerlas de todas las ediciones a la vez) — se pide bajo demanda con
 * `getFinalsEditionDetail` y se vuelve a pedir explícitamente (`refetch`) tras cada
 * mutación, porque aquí no hay una ruta de servidor real que Next.js pueda refrescar
 * sola. */
function FinalsDetail({ editionId, onBack, onDeleted }: { editionId: number; onBack: () => void; onDeleted: () => void }) {
  const [detail, setDetail] = useState<FinalsEditionDetail | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isStarting, startStarting] = useTransition();

  function refetch() {
    startLoading(async () => {
      setDetail(await getFinalsEditionDetail(editionId));
    });
  }

  useEffect(refetch, [editionId]);

  function handleRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startLoading(async () => {
      await updateFinalsEditionInfo(formData);
      refetch();
    });
  }

  function handleStartGroupStage() {
    setGroupError(null);
    startStarting(async () => {
      const { error } = await startGroupStage(editionId);
      if (error) {
        setGroupError(error);
        return;
      }
      refetch();
    });
  }

  if (!detail) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-eyebrow mb-4 text-xs text-muted-label hover:text-ink">
          ← Back to Finals
        </button>
        <p className="text-muted-label text-sm">{isLoading ? "Loading…" : "Edition not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onBack} className="text-eyebrow mb-2 block text-xs text-muted-label hover:text-ink">
            ← Back to Finals
          </button>
          <h1 className="text-headline text-2xl text-ink">{detail.displayName}</h1>
          <p className="text-muted-label mb-3 text-xs">
            Status: {detail.status} · {detail.kind === "tour_finals" ? "World Tour Finals" : "Next Gen Finals"} · {detail.year}
          </p>
          <form onSubmit={handleRename} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="finalsEditionId" value={detail.id} />
            <input
              type="text"
              name="displayName"
              defaultValue={detail.displayName}
              className="w-64 rounded border border-rule px-2 py-1 text-sm text-ink"
            />
            <button type="submit" className="text-eyebrow rounded-full border border-rule px-3 py-1.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500">
              Rename
            </button>
          </form>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <a href={`/finals/${detail.id}`} target="_blank" rel="noopener noreferrer" className="text-eyebrow text-xs text-blue-500 hover:underline">
            View public page
          </a>
          <DeleteFinalsEditionButton finalsEditionId={detail.id} onDeleted={onDeleted} />
        </div>
      </div>

      {groupError && (
        <p className="mb-4 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down">{groupError}</p>
      )}

      {detail.isSetup && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Group assignment</h2>
          <GroupAssignmentBoard
            participants={detail.activeParticipants.map((p) => ({ id: p.id, displayName: p.displayName, seed: p.seed, group: p.group as "A" | "B" }))}
            locked={false}
            onSwapped={refetch}
          />
          <button
            type="button"
            onClick={handleStartGroupStage}
            disabled={isStarting}
            className="text-eyebrow mt-4 rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {isStarting ? "Starting…" : "Start group stage"}
          </button>
        </section>
      )}

      {!detail.isSetup && (
        <>
          <section className="mb-8">
            <h2 className="text-headline mb-3 text-lg text-ink">Standings</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GroupStandingsTable groupLabel="A" rows={detail.groupA} />
              <GroupStandingsTable groupLabel="B" rows={detail.groupB} />
            </div>
          </section>

          {detail.allGroupMatches.length > 0 && (
            <section className="mb-8">
              <h2 className="text-headline mb-3 text-lg text-ink">Group matches</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {detail.allGroupMatches.map((m) => (
                  <MatchResultForm
                    key={m.id}
                    matchId={m.id}
                    label={`Group ${m.group}`}
                    player1={m.player1}
                    player2={m.player2}
                    format={detail.format}
                    initialWinnerId={m.winnerId ?? undefined}
                    initialSets={m.sets}
                    onSaved={refetch}
                  />
                ))}
              </div>
            </section>
          )}

          {detail.editableKnockout.length > 0 && (
            <section className="mb-8">
              <h2 className="text-headline mb-3 text-lg text-ink">Knockout matches</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {detail.editableKnockout.map((m) => (
                  <MatchResultForm
                    key={m.id}
                    matchId={m.id}
                    label={m.label}
                    player1={m.player1!}
                    player2={m.player2!}
                    format={detail.format}
                    initialWinnerId={m.winnerId ?? undefined}
                    initialSets={m.sets}
                    onSaved={refetch}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <QuickInputPanel finalsEditionId={detail.id} onApplied={refetch} />
          </section>
        </>
      )}

      <section>
        <h2 className="text-headline mb-3 text-lg text-ink">Alternates</h2>
        <div className="space-y-2">
          {detail.activeParticipants.map((p) => (
            <AlternateSubstitutionForm
              key={p.id}
              participantId={p.id}
              displayName={`${p.displayName} (seed ${p.seed})`}
              candidates={detail.candidates}
              onSubstituted={refetch}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Lista de ediciones de Finals + alta de una nueva — antes
 * app/admin/(panel)/finals/page.tsx + .../finals/new/page.tsx.
 */
export function FinalsSection({ editions, players }: { editions: FinalsEditionListRow[]; players: PlayerOption[] }) {
  const [view, setView] = useState<{ mode: "list" } | { mode: "new" } | { mode: "detail"; id: number }>({ mode: "list" });

  if (view.mode === "detail") {
    return (
      <FinalsDetail
        editionId={view.id}
        onBack={() => setView({ mode: "list" })}
        onDeleted={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "new") {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-headline text-2xl text-ink">New Finals edition</h1>
          <button type="button" onClick={() => setView({ mode: "list" })} className="text-eyebrow text-xs text-muted-label hover:text-ink">
            ← Back to list
          </button>
        </div>
        <NewFinalsEditionForm players={players} onCreated={(editionId) => setView({ mode: "detail", id: editionId })} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-headline text-2xl text-ink">Tour Finals</h1>
        <button
          type="button"
          onClick={() => setView({ mode: "new" })}
          className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800"
        >
          New edition
        </button>
      </div>

      {editions.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">No Finals editions yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {editions.map((e) => (
            <div key={e.id} className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-0">
              <span className="text-eyebrow shrink-0 rounded-full bg-muted-label/10 px-2.5 py-1 text-[10px] text-muted-label">
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-headline truncate text-ink">{e.displayName}</p>
                <p className="text-muted-label truncate text-xs">
                  {e.kind === "tour_finals" ? "World Tour Finals" : "Next Gen Finals"} · {e.year}
                </p>
              </div>
              <button type="button" onClick={() => setView({ mode: "detail", id: e.id })} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
                Manage
              </button>
              <a href={`/finals/${e.id}`} target="_blank" rel="noopener noreferrer" className="text-eyebrow shrink-0 text-xs text-muted-label hover:underline">
                View
              </a>
              <DeleteFinalsEditionButton finalsEditionId={e.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
