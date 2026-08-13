"use server";

import { redirect } from "next/navigation";
import { setSession } from "@/lib/session";

export async function loginAsPlayer(playerId: number) {
  await setSession(playerId);
  redirect("/dashboard");
}
