import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { players, playerClaimRequests, playerBuilds } from "@/db/schema";
import { getCurrentUser, getLinkedPlayerId } from "@/lib/auth";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { ClaimPlayerSearch } from "@/components/account/ClaimPlayerSearch";
import { SignInButton } from "@/components/account/SignInButton";
import { MatchLogUploadPrompt } from "@/components/account/MatchLogUploadPrompt";
import { PlayerProfileForm } from "@/components/account/PlayerProfileForm";
import { PlayerOverviewCard } from "@/components/account/PlayerOverviewCard";
import { BuildSection } from "@/components/account/BuildSection";
import { getPlayerOverview } from "@/lib/playerOverview";
import type { UpdatePlayerBuildInput } from "@/app/account/actions";
import { ACCELERATION_TRAITS, ALL_STAT_KEYS, ARCHETYPES, type AccelerationTrait, type Archetype, type StatKey } from "@/lib/buildStats";

const EMPTY_BUILD: UpdatePlayerBuildInput = {
  archetype: null,
  accelerationTrait: null,
  visibleStats: [],
  isPublic: false,
  forehandPower: null,
  forehandConsistency: null,
  forehandPrecision: null,
  backhandPower: null,
  backhandConsistency: null,
  backhandPrecision: null,
  servicePower: null,
  serviceConsistency: null,
  servicePrecision: null,
  forehandVolley: null,
  backhandVolley: null,
  smash: null,
  netPresence: null,
  focus: null,
  counter: null,
  lob: null,
  dropShot: null,
  topSpin: null,
  speed: null,
  stamina: null,
  muscleTone: null,
};

function isAccelerationTrait(v: string | null): v is AccelerationTrait {
  return v !== null && (ACCELERATION_TRAITS as readonly string[]).includes(v);
}

function isArchetype(v: string | null): v is Archetype {
  return v !== null && (ARCHETYPES as readonly string[]).includes(v);
}

function isStatKey(v: string): v is StatKey {
  return (ALL_STAT_KEYS as readonly string[]).includes(v);
}

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
      const [overview, [build]] = await Promise.all([
        getPlayerOverview(playerId, player.displayName),
        db.select().from(playerBuilds).where(eq(playerBuilds.playerId, playerId)),
      ]);
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <h1 className="text-headline text-2xl text-ink">Welcome back, {player.displayName}</h1>
            <Link
              href={`/players/${playerId}`}
              className="text-eyebrow shrink-0 rounded-full border border-rule px-4 py-1.5 text-xs text-ink transition-colors hover:border-blue-500 hover:text-blue-500"
            >
              View Tour Profile
            </Link>
          </div>
          <PlayerOverviewCard overview={overview} />
          <div className="mt-8">
            <h2 className="text-headline mb-4 text-lg text-ink">Your profile photo</h2>
            <AvatarUpload currentAvatarUrl={player.avatarUrl} isCustom={player.avatarIsCustom} discordAvatarUrl={user.image} />
          </div>
          <div className="mt-8">
            <h2 className="text-headline mb-4 text-lg text-ink">Your profile</h2>
            <PlayerProfileForm player={player} />
          </div>
          <div className="mt-8">
            <h2 className="text-headline mb-4 text-lg text-ink">Your Build</h2>
            <BuildSection
              initialBuild={
                build
                  ? {
                      ...build,
                      archetype: isArchetype(build.archetype) ? build.archetype : null,
                      accelerationTrait: isAccelerationTrait(build.accelerationTrait) ? build.accelerationTrait : null,
                      visibleStats: build.visibleStats.filter(isStatKey),
                    }
                  : EMPTY_BUILD
              }
              currentImageUrl={build?.characterImageUrl ?? null}
            />
          </div>
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
