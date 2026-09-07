import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players, playerClaimRequests, authUsers } from "@/db/schema";
import { searchPlayers } from "@/app/admin/players/actions";
import { approvePlayerClaim, rejectPlayerClaim } from "@/app/admin/players/claims/actions";
import { BulkKnownNamesForm } from "@/components/admin/players/BulkKnownNamesForm";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, claims] = await Promise.all([
    searchParams,
    db
      .select({
        claimId: playerClaimRequests.id,
        requestedAt: playerClaimRequests.requestedAt,
        playerId: players.id,
        playerDisplayName: players.displayName,
        userName: authUsers.name,
        userImage: authUsers.image,
      })
      .from(playerClaimRequests)
      .innerJoin(players, eq(players.id, playerClaimRequests.playerId))
      .innerJoin(authUsers, eq(authUsers.id, playerClaimRequests.userId))
      .where(eq(playerClaimRequests.status, "pending"))
      .orderBy(playerClaimRequests.requestedAt),
  ]);
  const rows = await searchPlayers(q?.trim() ?? "");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Players</h1>
        <p className="text-muted-label text-xs">
          Correct a displayed nationality, move a misattributed alias to the right player, or review pending
          profile-claim requests.
        </p>
      </div>

      {claims.length > 0 && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Pending claims</h2>
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {claims.map((row) => (
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
      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name…"
          className="w-full max-w-sm rounded border border-rule px-3 py-2 text-sm text-ink"
        />
      </form>

      <div className="overflow-hidden rounded-lg border border-rule bg-paper">
        {rows.length === 0 ? (
          <p className="text-muted-label px-4 py-8 text-center text-sm">No players found.</p>
        ) : (
          rows.map((p) => (
            <Link
              key={p.id}
              href={`/admin/players/${p.id}`}
              className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0 hover:bg-paper-tint"
            >
              <span className="text-ink">{p.displayName}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                {p.countryOverride && (
                  <span className="text-eyebrow rounded-full bg-lime/20 px-2 py-0.5 text-ink">
                    displaying {p.countryOverride}
                  </span>
                )}
                <span className="text-muted-label">{p.aliasCount} alias{p.aliasCount === 1 ? "" : "es"}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
