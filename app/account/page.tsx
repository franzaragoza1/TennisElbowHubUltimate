import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { players, playerClaimRequests } from "@/db/schema";
import { getCurrentUser, getLinkedPlayerId } from "@/lib/auth";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { ClaimPlayerSearch } from "@/components/account/ClaimPlayerSearch";
import { SignInButton } from "@/components/account/SignInButton";
import { MatchLogUploadPrompt } from "@/components/account/MatchLogUploadPrompt";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-headline mb-4 text-2xl text-ink">Sign in</h1>
        <p className="text-muted-label mb-6 text-sm">Sign in with Discord to claim your player profile.</p>
        <SignInButton />
        <p className="text-muted-label mt-6 text-xs">
          New here?{" "}
          <Link href="/welcome" className="text-blue-500 hover:underline">
            See how it works
          </Link>
        </p>
      </div>
    );
  }

  const playerId = await getLinkedPlayerId(user.id);

  if (playerId) {
    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (player) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-headline mb-8 text-2xl text-ink">Your profile photo, {player.displayName}</h1>
          <AvatarUpload currentAvatarUrl={player.avatarUrl} isCustom={player.avatarIsCustom} discordAvatarUrl={user.image} />
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
      <p className="text-muted-label mb-8 text-sm">
        Search for your name to link your account — everyone on the tour is already here, imported from the
        Mana Games forum. An admin approves the link, so make sure you search for the name you actually play
        under.
      </p>

      <h2 className="text-eyebrow mb-2 text-xs text-muted-label">Claim your profile</h2>
      <ClaimPlayerSearch />

      <div className="mt-8">
        <MatchLogUploadPrompt />
      </div>
    </div>
  );
}
