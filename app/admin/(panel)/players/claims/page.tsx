import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players, playerClaimRequests, authUsers } from "@/db/schema";
import { approvePlayerClaim, rejectPlayerClaim } from "@/app/admin/players/claims/actions";

export const dynamic = "force-dynamic";

export default async function AdminPlayerClaimsPage() {
  const rows = await db
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
    .orderBy(playerClaimRequests.requestedAt);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-headline text-2xl text-ink">Player Claims</h1>
        <p className="text-muted-label text-xs">
          Requests from Discord users to link their account to an existing player profile.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-paper">
        {rows.length === 0 ? (
          <p className="text-muted-label px-4 py-8 text-center text-sm">No pending claims.</p>
        ) : (
          rows.map((row) => (
            <div key={row.claimId} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
              <div className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Discord */}
                {row.userImage && <img src={row.userImage} alt="" className="h-8 w-8 shrink-0 rounded-full" />}
                <div className="min-w-0">
                  <p className="text-ink truncate">
                    {row.userName} <span className="text-muted-label">wants</span> {row.playerDisplayName}
                  </p>
                  <p className="text-muted-label text-xs">
                    Requested {row.requestedAt.toLocaleDateString("en-US")}
                  </p>
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
          ))
        )}
      </div>
    </div>
  );
}
