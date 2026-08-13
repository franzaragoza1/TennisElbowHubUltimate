import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { getSessionPlayerId } from "@/lib/session";
import { parseAvatarOptions } from "@/lib/avatar";
import { AvatarEditor } from "@/components/dashboard/AvatarEditor";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const playerId = await getSessionPlayerId();
  if (!playerId) redirect("/login");

  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-eyebrow text-xs text-muted-label">Demo — no real password yet</p>
      <h1 className="text-headline mb-8 text-2xl text-navy-900">
        Customise your avatar, {player.displayName}
      </h1>
      <AvatarEditor initialOptions={parseAvatarOptions(player.character)} />
    </div>
  );
}
