"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getRecentNotifications, type NotificationRow } from "@/lib/notifications";

export async function getMyRecentNotifications(limit?: number): Promise<NotificationRow[]> {
  const user = await requireUser();
  return getRecentNotifications(user.id, limit);
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/notifications");
}
