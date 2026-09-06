import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { players } from "@/db/schema";

export interface CurrentUser {
  id: string;
  name: string | null;
  image: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name ?? null, image: session.user.image ?? null };
}

/** Mismo motivo que lib/adminSession.ts::requireAdmin: un Server Action es un endpoint público. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  return user;
}

export async function getLinkedPlayerId(userId: string): Promise<number | null> {
  const [row] = await db.select({ id: players.id }).from(players).where(eq(players.linkedUserId, userId));
  return row?.id ?? null;
}
