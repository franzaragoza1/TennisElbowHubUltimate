import { db } from "@/db/client";
import { players } from "@/db/schema";
import { LoginSearch } from "@/components/auth/LoginSearch";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const allPlayers = await db
    .select({ id: players.id, displayName: players.displayName })
    .from(players)
    .orderBy(players.displayName);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-headline mb-2 text-2xl text-navy-900">Sign in</h1>
      <p className="text-muted-label mb-6 text-sm">
        Demo — no real password yet. Find your name and sign in as that player.
      </p>
      <LoginSearch players={allPlayers} />
    </div>
  );
}
