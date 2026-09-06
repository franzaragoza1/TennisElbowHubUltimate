import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players, playerClaimRequests } from "@/db/schema";
import { getCurrentUser, getLinkedPlayerId } from "@/lib/auth";
import { parseAvatarOptions } from "@/lib/avatar";
import { AvatarEditor } from "@/components/dashboard/AvatarEditor";
import { ClaimPlayerSearch } from "@/components/account/ClaimPlayerSearch";
import { CreatePlayerForm } from "@/components/account/CreatePlayerForm";
import { SignInButton } from "@/components/account/SignInButton";
import { MatchLogUploadPrompt } from "@/components/account/MatchLogUploadPrompt";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-headline mb-4 text-2xl text-ink">Sign in</h1>
        <p className="text-muted-label mb-6 text-sm">Sign in with Discord to claim or create your player profile.</p>
        <SignInButton />
      </div>
    );
  }

  const playerId = await getLinkedPlayerId(user.id);

  if (playerId) {
    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (player) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-headline mb-8 text-2xl text-ink">Customise your avatar, {player.displayName}</h1>
          <AvatarEditor initialOptions={parseAvatarOptions(player.character)} />
          <div className="mt-8">
            <MatchLogUploadPrompt />
          </div>
        </div>
      );
    }
  }

  const [pendingClaim] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.userId, user.id), eq(playerClaimRequests.status, "pending")));

  if (pendingClaim) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-headline mb-4 text-2xl text-ink">Request pending</h1>
        <p className="text-muted-label mb-8 text-sm">
          Your request to claim a player profile is waiting for an admin to approve it.
        </p>
        <div className="text-left">
          <MatchLogUploadPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-headline mb-2 text-2xl text-ink">Welcome, {user.name}</h1>
      <p className="text-muted-label mb-8 text-sm">Claim your existing player profile, or create a new one.</p>

      <h2 className="text-eyebrow mb-2 text-xs text-muted-label">Claim an existing profile</h2>
      <ClaimPlayerSearch />

      <h2 className="text-eyebrow mt-8 mb-2 text-xs text-muted-label">Or create a new one</h2>
      <CreatePlayerForm />

      <div className="mt-8">
        <MatchLogUploadPrompt />
      </div>
    </div>
  );
}
