"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** `endpoint` es la clave natural (la asigna el navegador) — volver a suscribirse en el
 * mismo dispositivo actualiza la fila existente en vez de duplicarla. */
export async function subscribeToPush(subscription: PushSubscriptionInput, userAgent?: string): Promise<void> {
  const user = await requireUser();
  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
        lastSeenAt: new Date(),
      },
    });
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await requireUser();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
