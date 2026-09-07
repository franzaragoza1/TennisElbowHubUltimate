"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getNativeTournamentDetail,
  withdrawRegistration,
  generateDraw,
  type NativeTournamentDetail,
} from "@/app/admin/native-tournaments/[id]/actions";
import { listNativeTournaments, type NativeTournamentListRow } from "@/app/admin/native-tournaments/actions";
import { deriveTournamentStatus } from "@/lib/tournamentStatus";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { BracketColumns } from "@/components/tournament/BracketColumns";
import { RegistrationSearch } from "@/components/admin/native-tournaments/RegistrationSearch";
import { ResultEntryForm } from "@/components/admin/native-tournaments/ResultEntryForm";
import { CreateNativeTournamentForm } from "@/components/admin/native-tournaments/CreateNativeTournamentForm";

/** Ficha de UN torneo nativo — antes
 * app/admin/(panel)/native-tournaments/[id]/page.tsx. Igual criterio que Finals: el
 * detalle se pide bajo demanda y se vuelve a pedir a mano tras cada mutación. */
function NativeTournamentDetailView({ editionId, onBack }: { editionId: number; onBack: () => void }) {
  const [detail, setDetail] = useState<NativeTournamentDetail | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [drawError, setDrawError] = useState<string | null>(null);

  function refetch() {
    startLoading(async () => {
      setDetail(await getNativeTournamentDetail(editionId));
    });
  }

  useEffect(refetch, [editionId]);

  function handleGenerateDraw() {
    if (!detail) return;
    setDrawError(null);
    const formData = new FormData();
    formData.set("editionId", String(editionId));
    startGenerating(async () => {
      const { error } = await generateDraw(formData);
      if (error) {
        setDrawError(error);
        return;
      }
      refetch();
    });
  }

  function handleWithdraw(registrationId: number) {
    const formData = new FormData();
    formData.set("registrationId", String(registrationId));
    startLoading(async () => {
      await withdrawRegistration(formData);
      refetch();
    });
  }

  if (!detail) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-eyebrow mb-4 text-xs text-muted-label hover:text-ink">
          ← Back to Native Tournaments
        </button>
        <p className="text-muted-label text-sm">{isLoading ? "Loading…" : "Tournament not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onBack} className="text-eyebrow mb-2 block text-xs text-muted-label hover:text-ink">
            ← Back to Native Tournaments
          </button>
          <h1 className="text-headline text-2xl text-ink">
            {detail.eventName} {detail.year}
          </h1>
          <p className="text-muted-label text-xs">
            {detail.category} · Draw of {detail.drawSize}
          </p>
        </div>
        <TournamentStatusBadge status={detail.status} />
      </div>

      {!detail.hasDraw && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Registrations</h2>
          <RegistrationSearch editionId={editionId} onRegistered={refetch} />

          <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-paper">
            {detail.registrations.length === 0 ? (
              <p className="text-muted-label px-4 py-8 text-center text-sm">Nobody registered yet.</p>
            ) : (
              detail.registrations.map((r) => (
                <div key={r.registrationId} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                  <span className="text-ink">
                    {r.displayName}
                    {r.seed !== null && <span className="text-muted-label"> · Seed {r.seed}</span>}
                  </span>
                  <button type="button" onClick={() => handleWithdraw(r.registrationId)} className="text-eyebrow text-xs text-down hover:underline">
                    Withdraw
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleGenerateDraw}
              disabled={isGenerating || detail.registrations.length < detail.drawSize / 2}
              className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? "Generating…" : "Generate draw"}
            </button>
            {detail.registrations.length < detail.drawSize / 2 && (
              <p className="text-muted-label mt-2 text-xs">
                Needs at least {detail.drawSize / 2} registered players (has {detail.registrations.length}).
              </p>
            )}
            {drawError && <p className="text-down mt-2 text-xs">{drawError}</p>}
          </div>
        </section>
      )}

      {detail.hasDraw && (
        <>
          <section className="mb-8">
            <BracketColumns matches={detail.bracketMatches} drawSize={detail.drawSize} editionId={detail.id} />
          </section>

          {detail.decidable.length > 0 && (
            <section>
              <h2 className="text-headline mb-3 text-lg text-ink">Enter results</h2>
              <div className="flex flex-col gap-2">
                {detail.decidable.map((slot) => (
                  <ResultEntryForm
                    key={slot.id}
                    pendingSlotId={slot.id}
                    round={slot.round}
                    player1={{ id: slot.player1Id!, name: slot.player1Name! }}
                    player2={{ id: slot.player2Id!, name: slot.player2Name! }}
                    onSaved={refetch}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Lista de torneos nativos + alta de uno nuevo — antes
 * app/admin/(panel)/native-tournaments/page.tsx. Esta sección nunca tuvo pestaña ni
 * enlace propio en el panel viejo (huérfana, solo alcanzable tecleando la URL a
 * mano) — pedido explícito de que quede de verdad dentro de la navegación esta vez. */
export function NativeTournamentsSection({ initialRows }: { initialRows: NativeTournamentListRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [view, setView] = useState<{ mode: "list" } | { mode: "detail"; id: number }>({ mode: "list" });
  const [, startRefreshingList] = useTransition();

  function refreshList() {
    startRefreshingList(async () => {
      setRows(await listNativeTournaments());
    });
  }

  if (view.mode === "detail") {
    return (
      <NativeTournamentDetailView
        editionId={view.id}
        onBack={() => {
          setView({ mode: "list" });
          refreshList();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Native Tournaments</h1>
        <p className="text-muted-label text-xs">
          Tournaments run entirely inside the site — not scraped from anywhere, admin-managed start to finish.
        </p>
      </div>

      <CreateNativeTournamentForm onCreated={(editionId) => setView({ mode: "detail", id: editionId })} />

      <section className="mt-8">
        <h2 className="text-headline mb-3 text-lg text-ink">All native tournaments</h2>
        {rows.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">None created yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {rows.map((r) => {
              const status = deriveTournamentStatus(r.hasDecidedFinal ? [{ round: "F" }] : [], r.hasDraw);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setView({ mode: "detail", id: r.id })}
                  className="flex w-full items-center justify-between gap-3 border-b border-rule px-4 py-3 text-left text-sm last:border-0 hover:bg-paper-tint"
                >
                  <span className="text-ink">
                    {r.eventName} {r.year} · {r.category} · Draw of {r.drawSize}
                  </span>
                  <TournamentStatusBadge status={status} />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
