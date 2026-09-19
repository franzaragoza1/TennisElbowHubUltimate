"use server";

import { and, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { discussionTopics, topicComments, topicCommentLikes, topicLikes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isAdmin, requireAdmin } from "@/lib/adminSession";
import { isRateLimited } from "@/lib/rateLimit";
import { slugify, uniqueSlug } from "@/lib/topicSlug";
import { createNotification, markNotificationPushSent } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/pushNotifications/send";

const MAX_COMMENT_LENGTH = 1000;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 5000;

export interface PostCommentOutcome {
  error: string | null;
}

export interface ToggleLikeOutcome {
  count: number;
  liked: boolean;
}

export interface CreateTopicOutcome {
  error: string | null;
  slug: string | null;
}

/** Límite más estricto que el de responder (1/hora vs 5/5min) — a propósito: un tema
 * nuevo es contenido de portada del feed, no una respuesta hundida bajo otras.
 *
 * Devuelve el slug en vez de hacer `redirect()` aquí — esta acción la invoca el cliente
 * a mano dentro de un `startTransition` (para poder enseñar el error inline sin recargar
 * la página), no vía `<form action={createTopic}>`; un `redirect()` lanzado así se
 * propaga como una promesa rechazada normal y corriente en vez del aviso especial que
 * React sabe interceptar solo cuando la propia acción es el `action` del formulario —
 * el botón se quedaba en "Posting…" para siempre (bug real, encontrado probando el
 * flujo de verdad). La navegación la hace el cliente con el slug que se le devuelve.
 */
export async function createTopic(formData: FormData): Promise<CreateTopicOutcome> {
  const user = await requireUser();

  if (await isRateLimited(`topic-create:${user.id}`, 60 * 60 * 1000, 3)) {
    return { error: "Too many topics — try again in an hour.", slug: null };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Give your topic a title.", slug: null };
  if (title.length > MAX_TITLE_LENGTH) return { error: `Titles are limited to ${MAX_TITLE_LENGTH} characters.`, slug: null };
  if (!body) return { error: "Write something before posting.", slug: null };
  if (body.length > MAX_BODY_LENGTH) return { error: `Topics are limited to ${MAX_BODY_LENGTH} characters.`, slug: null };

  const slug = await uniqueSlug(slugify(title) || "topic", null);
  const [created] = await db.insert(discussionTopics).values({ title, body, authorUserId: user.id, slug }).returning({ slug: discussionTopics.slug });

  revalidatePath("/discussions");
  return { error: null, slug: created.slug };
}

export async function postTopicComment(topicId: number, slug: string, formData: FormData): Promise<PostCommentOutcome> {
  const user = await requireUser();

  const [topic] = await db
    .select({ status: discussionTopics.status, title: discussionTopics.title, authorUserId: discussionTopics.authorUserId })
    .from(discussionTopics)
    .where(eq(discussionTopics.id, topicId));
  if (!topic) return { error: "This topic no longer exists." };
  if (topic.status === "locked") return { error: "This topic is locked — no new replies." };

  if (await isRateLimited(`topic-comment:${user.id}`, 5 * 60 * 1000, 5)) {
    return { error: "Too many replies — try again in a few minutes." };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something before posting." };
  if (body.length > MAX_COMMENT_LENGTH) return { error: `Replies are limited to ${MAX_COMMENT_LENGTH} characters.` };

  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  // rootId se calcula aquí, nunca se confía en el cliente — mismo criterio que
  // app/news/[slug]/actions.ts::postComment.
  let rootId: number | null = null;
  let parentUserId: string | null = null;
  if (parentId !== null) {
    const [parent] = await db
      .select({ id: topicComments.id, rootId: topicComments.rootId, userId: topicComments.userId })
      .from(topicComments)
      .where(eq(topicComments.id, parentId));
    if (!parent) return { error: "That comment no longer exists." };
    rootId = parent.rootId ?? parent.id;
    parentUserId = parent.userId;
  }

  await db.insert(topicComments).values({ topicId, userId: user.id, body, parentId, rootId });
  await db.update(discussionTopics).set({ lastActivityAt: new Date() }).where(eq(discussionTopics.id, topicId));

  revalidatePath(`/discussions/${slug}`);
  revalidatePath("/discussions");

  // Disparo síncrono, no del ciclo de sondeo de scripts/liveScoresSync.ts /
  // scripts/discordBot.ts (design decision 9 del plan) — es un suceso de una sola vez,
  // no algo que un sondeo periódico vaya a alcanzar igual un rato después. El push en sí
  // no se espera (`sendPushToUser` sin `await`): Render corre esto como proceso Node
  // persistente, no una función serverless con timeout, así que dejarlo terminar en
  // segundo plano no arriesga la respuesta al usuario que acaba de comentar.
  const recipientUserId = parentId !== null ? parentUserId : topic.authorUserId;
  if (recipientUserId && recipientUserId !== user.id) {
    const notifyTitle = `${user.name ?? "Someone"} replied to your ${parentId !== null ? "comment" : "topic"} "${topic.title}"`;
    const href = `/discussions/${slug}`;
    createNotification({
      userId: recipientUserId,
      type: parentId !== null ? "comment_reply" : "topic_reply",
      title: notifyTitle,
      body: body.slice(0, 200),
      href,
    }).then((notificationId) => {
      sendPushToUser(recipientUserId, { title: notifyTitle, body: body.slice(0, 200), href })
        .then(() => markNotificationPushSent(notificationId))
        .catch(() => {});
    });
  }

  return { error: null };
}

export async function deleteTopicComment(commentId: number, slug: string): Promise<void> {
  const user = await requireUser();

  const [comment] = await db.select({ userId: topicComments.userId }).from(topicComments).where(eq(topicComments.id, commentId));
  if (!comment) return;

  const canDelete = comment.userId === user.id || (await isAdmin(user));
  if (!canDelete) return;

  await db.delete(topicComments).where(eq(topicComments.id, commentId));
  revalidatePath(`/discussions/${slug}`);
}

export async function toggleTopicLike(topicId: number, slug: string): Promise<ToggleLikeOutcome> {
  const user = await requireUser();

  const [existing] = await db.select({ id: topicLikes.id }).from(topicLikes).where(and(eq(topicLikes.topicId, topicId), eq(topicLikes.userId, user.id)));
  if (existing) {
    await db.delete(topicLikes).where(eq(topicLikes.id, existing.id));
  } else {
    await db.insert(topicLikes).values({ topicId, userId: user.id });
  }

  revalidatePath(`/discussions/${slug}`);
  const [{ value }] = await db.select({ value: count() }).from(topicLikes).where(eq(topicLikes.topicId, topicId));
  return { count: value, liked: !existing };
}

export async function toggleTopicCommentLike(commentId: number, slug: string): Promise<ToggleLikeOutcome> {
  const user = await requireUser();

  const [existing] = await db
    .select({ id: topicCommentLikes.id })
    .from(topicCommentLikes)
    .where(and(eq(topicCommentLikes.commentId, commentId), eq(topicCommentLikes.userId, user.id)));
  if (existing) {
    await db.delete(topicCommentLikes).where(eq(topicCommentLikes.id, existing.id));
  } else {
    await db.insert(topicCommentLikes).values({ commentId, userId: user.id });
  }

  revalidatePath(`/discussions/${slug}`);
  const [{ value }] = await db.select({ value: count() }).from(topicCommentLikes).where(eq(topicCommentLikes.commentId, commentId));
  return { count: value, liked: !existing };
}

export async function lockTopic(topicId: number, slug: string): Promise<void> {
  await requireAdmin();
  await db.update(discussionTopics).set({ status: "locked" }).where(eq(discussionTopics.id, topicId));
  revalidatePath(`/discussions/${slug}`);
  revalidatePath("/discussions");
}

export async function unlockTopic(topicId: number, slug: string): Promise<void> {
  await requireAdmin();
  await db.update(discussionTopics).set({ status: "open" }).where(eq(discussionTopics.id, topicId));
  revalidatePath(`/discussions/${slug}`);
  revalidatePath("/discussions");
}

export async function deleteTopic(topicId: number): Promise<void> {
  await requireAdmin();
  await db.delete(discussionTopics).where(eq(discussionTopics.id, topicId));
  revalidatePath("/discussions");
  redirect("/discussions");
}

/** Igual que app/admin/comments/actions.ts::deleteCommentAsAdmin, pero para la pestaña
 * de moderación site-wide de respuestas de temas: ahí no se tiene el slug a mano (la
 * lista mezcla respuestas de temas distintos), así que se busca aquí antes de borrar. */
export async function deleteTopicCommentAsAdmin(commentId: number): Promise<void> {
  await requireAdmin();

  const [row] = await db
    .select({ slug: discussionTopics.slug })
    .from(topicComments)
    .innerJoin(discussionTopics, eq(discussionTopics.id, topicComments.topicId))
    .where(eq(topicComments.id, commentId));
  if (!row) return;

  await db.delete(topicComments).where(eq(topicComments.id, commentId));
  revalidatePath(`/discussions/${row.slug}`);
}
