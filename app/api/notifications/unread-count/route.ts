import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";

/** Sondeado por la campana de NotificationBell — sin sesión responde 0 en vez de
 * redirigir o dar error, para que el propio polling no tenga que comprobar la sesión
 * primero (mismo criterio que app/api/live-scores/route.ts, público sin más). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });

  const count = await getUnreadCount(user.id);
  return NextResponse.json({ count });
}
