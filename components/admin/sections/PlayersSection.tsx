"use client";

import { useEffect, useState, useTransition } from "react";
import { approvePlayerClaim, rejectPlayerClaim } from "@/app/admin/players/claims/actions";
import { getOtherPlayers, getPlayerAdminDetail, searchPlayers, type OtherPlayerRow, type PlayerAdminDetail, type PlayerSearchRow } from "@/app/admin/players/actions";
import { BulkKnownNamesForm } from "@/components/admin/players/BulkKnownNamesForm";
import { CountryOverrideForm } from "@/components/admin/players/CountryOverrideForm";
import { AliasReassignForm } from "@/components/admin/players/AliasReassignForm";
import { KnownNamesForm } from "@/components/admin/players/KnownNamesForm";
import { UnlinkAccountButton } from "@/components/admin/players/UnlinkAccountButton";

export interface PendingClaimRow {
  claimId: number;
  requestedAt: Date;
  playerId: number;
  playerDisplayName: string;
  userName: string | null;
  userImage: string | null;
}

/** Ficha de un jugador concreto — antes app/admin/(panel)/players/[id]/page.tsx.
 * `getPlayerAdminDetail`/`getOtherPlayers` ya eran funciones "use server"
 * exportadas, así que se piden bajo demanda al abrir un jugador en vez de traer el
 * detalle de todos de golpe. */
function PlayerDetail({ playerId, onBack }: { playerId: number; onBack: () => void }) {
  const [detail, setDetail] = useState<PlayerAdminDetail | null>(null);
  const [candidates, setCandidates] = useState<OtherPlayerRow[]>([]);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const [d, c] = await Promise.all([getPlayerAdminDetail(playerId), getOtherPlayers(playerId)]);
      setDetail(d);
      setCandidates(c);
    });
  }, [playerId]);

  if (isLoading || !detail) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-eyebrow mb-4 text-xs text-muted-label hover:text-ink">
          ← Back to players
        </button>
        <p className="text-muted-label text-sm">{isLoading ? "Loading…" : "Player not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="text-eyebrow mb-2 block text-xs text-muted-label hover:text-ink">
            ← Back to players
          </button>
          <h1 className="text-headline text-2xl text-ink">{detail.displayName}</h1>
          <p className="text-muted-label text-xs">Player #{detail.id}</p>
        </div>
        <a href={`/players/${detail.id}`} target="_blank" rel="noopener noreferrer" className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
          View public page
        </a>
      </div>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Linked account</h2>
        {detail.linkedAccount ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-paper px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {detail.linkedAccount.image && (
                // eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Discord
                <img src={detail.linkedAccount.image} alt="" className="h-8 w-8 shrink-0 rounded-full" />
              )}
              <p className="text-ink truncate text-sm">{detail.linkedAccount.name ?? "Unknown Discord user"}</p>
            </div>
            <UnlinkAccountButton playerId={detail.id} />
          </div>
        ) : (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-3 text-sm">
            No Discord account linked to this profile.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Nationality</h2>
        <CountryOverrideForm playerId={detail.id} realCountry={detail.country} countryOverride={detail.countryOverride} />
      </section>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Known names (for match log matching)</h2>
        <KnownNamesForm playerId={detail.id} knownNames={detail.knownNames} />
      </section>

      <section>
        <h2 className="text-headline mb-3 text-lg text-ink">Aliases</h2>
        {detail.aliases.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            No aliases on record for this player.
          </p>
        ) : (
          <div className="space-y-2">
            {detail.aliases.map((a) => (
              <AliasReassignForm
                key={a.id}
                aliasId={a.id}
                currentPlayerId={detail.id}
                sourceSlug={a.sourceSlug}
                externalId={a.externalId}
                displayName={a.displayName}
                candidates={candidates}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Lista de jugadores + solicitudes de vinculación pendientes — antes
 * app/admin/(panel)/players/page.tsx (ya fusionada con Player Claims). La búsqueda
 * por nombre ahora llama a `searchPlayers` directamente desde el cliente (antes era
 * un `?q=` en la URL con navegación completa) — sin ruta propia a la que navegar
 * dentro de /account.
 */
export function PlayersSection({ initialRows, initialClaims }: { initialRows: PlayerSearchRow[]; initialClaims: PendingClaimRow[] }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [isSearching, startSearching] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearching(async () => {
      setRows(await searchPlayers(query.trim()));
    });
  }

  if (selectedPlayerId !== null) {
    return <PlayerDetail playerId={selectedPlayerId} onBack={() => setSelectedPlayerId(null)} />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Players</h1>
        <p className="text-muted-label text-xs">
          Correct a displayed nationality, move a misattributed alias to the right player, or review pending
          profile-claim requests.
        </p>
      </div>

      {initialClaims.length > 0 && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Pending claims</h2>
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {initialClaims.map((row) => (
              <div key={row.claimId} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Discord */}
                  {row.userImage && <img src={row.userImage} alt="" className="h-8 w-8 shrink-0 rounded-full" />}
                  <div className="min-w-0">
                    <p className="text-ink truncate">
                      {row.userName} <span className="text-muted-label">wants</span> {row.playerDisplayName}
                    </p>
                    <p className="text-muted-label text-xs">Requested {row.requestedAt.toLocaleDateString("en-US")}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  <form action={approvePlayerClaim}>
                    <input type="hidden" name="claimId" value={row.claimId} />
                    <button type="submit" className="text-eyebrow text-xs text-up hover:underline">
                      Approve
                    </button>
                  </form>
                  <form action={rejectPlayerClaim}>
                    <input type="hidden" name="claimId" value={row.claimId} />
                    <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <BulkKnownNamesForm />

      <h2 className="text-headline mt-8 mb-3 text-lg text-ink">All players</h2>
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full max-w-sm rounded border border-rule px-3 py-2 text-sm text-ink"
        />
      </form>

      <div className="overflow-hidden rounded-lg border border-rule bg-paper">
        {isSearching ? (
          <p className="text-muted-label px-4 py-8 text-center text-sm">Searching…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-label px-4 py-8 text-center text-sm">No players found.</p>
        ) : (
          rows.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlayerId(p.id)}
              className="flex w-full items-center justify-between gap-3 border-b border-rule px-4 py-3 text-left text-sm last:border-0 hover:bg-paper-tint"
            >
              <span className="text-ink">{p.displayName}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                {p.countryOverride && (
                  <span className="text-eyebrow rounded-full bg-lime/20 px-2 py-0.5 text-ink">
                    displaying {p.countryOverride}
                  </span>
                )}
                <span className="text-muted-label">
                  {p.aliasCount} alias{p.aliasCount === 1 ? "" : "es"}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
