"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { news, newsPlayers } from "@/db/schema";
import {
  checkPassword,
  endAdminSession,
  isAdmin,
  startAdminSession,
} from "@/lib/adminSession";
import { NEWS_CATEGORIES } from "@/lib/newsCategories";

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) return "Wrong password.";
  if (!(await startAdminSession())) return "Admin is not configured on this deployment.";
  redirect("/admin");
}

export async function logoutAdmin() {
  await endAdminSession();
  redirect("/admin/login");
}

/** Cada acción revalida su propia puerta: un Server Action es un endpoint público. */
async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Añade un sufijo si el slug ya existe, para no chocar con el índice único. */
async function uniqueSlug(base: string, excludeId: number | null): Promise<string> {
  const taken = await db.select({ id: news.id, slug: news.slug }).from(news);
  const inUse = new Set(taken.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!inUse.has(base)) return base;
  let n = 2;
  while (inUse.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function parsePlayerIds(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
}

export async function saveNews(formData: FormData): Promise<void> {
  await requireAdmin();

  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? Number(idRaw) : null;

  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "REPORT");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const editionRaw = String(formData.get("editionId") ?? "").trim();
  const editionId = editionRaw ? Number(editionRaw) : null;
  const publish = formData.get("publish") === "on";
  const playerIds = parsePlayerIds(String(formData.get("playerIds") ?? ""));

  if (!title || !excerpt || !body) redirect(id ? `/admin/news/${id}?error=missing` : "/admin/news/new?error=missing");

  const status = publish ? "published" : "draft";
  const values = {
    title,
    excerpt,
    body,
    category: (NEWS_CATEGORIES as readonly string[]).includes(category) ? category : "REPORT",
    imageUrl,
    editionId: editionId && Number.isInteger(editionId) ? editionId : null,
    status,
    updatedAt: new Date(),
  };

  let newsId: number;
  if (id) {
    const [existing] = await db.select().from(news).where(eq(news.id, id));
    if (!existing) redirect("/admin");
    const slug = await uniqueSlug(slugify(title), id);
    await db
      .update(news)
      .set({
        ...values,
        slug,
        // La fecha de publicación se fija la primera vez que sale, y ya no se mueve.
        publishedAt: publish ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      })
      .where(eq(news.id, id));
    newsId = id;
    await db.delete(newsPlayers).where(eq(newsPlayers.newsId, id));
  } else {
    const slug = await uniqueSlug(slugify(title), null);
    const [created] = await db
      .insert(news)
      .values({ ...values, slug, publishedAt: publish ? new Date() : null })
      .returning({ id: news.id });
    newsId = created.id;
  }

  if (playerIds.length > 0) {
    await db.insert(newsPlayers).values(playerIds.map((playerId) => ({ newsId, playerId })));
  }

  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/admin");
  for (const playerId of playerIds) revalidatePath(`/players/${playerId}`);

  redirect("/admin");
}

export async function deleteNews(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/admin");

  await db.delete(news).where(eq(news.id, id));

  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/admin");
  redirect("/admin");
}
