import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { H2HView } from "@/components/h2h/H2HView";
import { H2HPicker, type PlayerOption } from "@/components/h2h/H2HPicker";
import { loadH2HData } from "@/lib/h2hPage";

export const revalidate = 3600;

export default async function H2HPage({
  params,
}: {
  params: Promise<{ p1: string; p2: string }>;
}) {
  const { p1, p2 } = await params;
  const player1Id = Number(p1);
  const player2Id = Number(p2);
  if (!Number.isInteger(player1Id) || !Number.isInteger(player2Id) || player1Id === player2Id) {
    notFound();
  }

  const [data, allPlayers] = await Promise.all([
    loadH2HData(player1Id, player2Id),
    db
      .select({ id: players.id, displayName: players.displayName })
      .from(players)
      .orderBy(players.displayName) as Promise<PlayerOption[]>,
  ]);
  if (!data) notFound();

  return (
    <div>
      <div className="bg-navy-900 pt-8">
        <div className="tour-container">
          <H2HPicker players={allPlayers} />
        </div>
      </div>
      <H2HView data={data} />
    </div>
  );
}
