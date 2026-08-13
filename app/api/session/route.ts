import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { getSessionPlayerId } from "@/lib/session";

export async function GET() {
  const playerId = await getSessionPlayerId();
  if (!playerId) return NextResponse.json(null);

  const [player] = await db
    .select({ displayName: players.displayName })
    .from(players)
    .where(eq(players.id, playerId));

  if (!player) return NextResponse.json(null);
  return NextResponse.json({ playerId, displayName: player.displayName });
}
