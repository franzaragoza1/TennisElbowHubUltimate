import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, playerClaimRequests, players } from "@/db/schema";
import { PlayersSection } from "@/components/admin/sections/PlayersSection";
import { searchPlayers } from "@/app/admin/players/actions";

export default async function AdminPlayersPage() {
  const [rows, claims] = await Promise.all([
    searchPlayers(""),
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
  return <PlayersSection initialRows={rows} initialClaims={claims} />;
}
