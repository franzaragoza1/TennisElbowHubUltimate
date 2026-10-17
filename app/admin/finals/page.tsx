import { db } from "@/db/client";
import { players } from "@/db/schema";
import { FinalsSection } from "@/components/admin/sections/FinalsSection";
import { listFinalsEditions } from "@/lib/finals/queries";

export default async function AdminFinalsPage() {
  const [editions, playerOptions] = await Promise.all([
    listFinalsEditions(),
    db.select({ id: players.id, displayName: players.displayName }).from(players),
  ]);
  return <FinalsSection editions={editions} players={playerOptions} />;
}
