import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  href: string;
  readAt: Date | null;
  createdAt: Date;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return value;
}

export async function getRecentNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export interface CreateNotificationParams {
  userId: string;
  type: "match_live" | "match_finished" | "topic_reply" | "comment_reply";
  title: string;
  body?: string | null;
  href: string;
}

/** La fila se crea SIEMPRE, se consiga enviar el push o no — ver el comentario de
 * `notifications` en db/schema.ts. El push en sí (best-effort, lib/pushNotifications/
 * send.ts) se dispara aparte, nunca antes de que esto exista. */
export async function createNotification(params: CreateNotificationParams): Promise<number> {
  const [row] = await db.insert(notifications).values(params).returning({ id: notifications.id });
  return row.id;
}

export async function markNotificationPushSent(notificationId: number): Promise<void> {
  await db.update(notifications).set({ pushSentAt: new Date() }).where(eq(notifications.id, notificationId));
}
