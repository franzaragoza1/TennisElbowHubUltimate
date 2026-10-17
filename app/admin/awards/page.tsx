import { db } from "@/db/client";
import { players } from "@/db/schema";
import { AwardsSection } from "@/components/admin/sections/AwardsSection";
import { listDiscordRoleOptions } from "@/app/admin/awards/actions";
import { listAwardPeriods } from "@/lib/awards/queries";

export default async function AdminAwardsPage() {
  const [periods, playerOptions, discordRoles] = await Promise.all([
    listAwardPeriods(),
    db.select({ id: players.id, displayName: players.displayName }).from(players),
    listDiscordRoleOptions(),
  ]);
  return <AwardsSection periods={periods} players={playerOptions} discordRoles={discordRoles} />;
}
