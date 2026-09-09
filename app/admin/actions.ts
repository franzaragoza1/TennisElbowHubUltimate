"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { authUsers, news, newsPlayers } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { NEWS_CATEGORIES } from "@/lib/newsCategories";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richText";
import { slugify, uniqueSlug, parsePlayerIds } from "@/lib/newsSlug";
import type { NewsFormValues } from "@/components/admin/NewsForm";

export interface NewsListRow {
  id: number;
  title: string;
  category: string;
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
  /** Nombre de Discord de quien envió esto (app/account/actions.ts::submitReporterStory)
   * — null para lo escrito por un admin o generado por IA, ver news.submittedByUserId. */
  submittedByName: string | null;
}

/** Absorbido dentro de /account (components/admin/sections/NewsSection.tsx) — antes
 * era la propia app/admin/(panel)/page.tsx. */
export async function getNewsListRows(): Promise<NewsListRow[]> {
  await requireAdmin();
  return db
    .select({
      id: news.id,
      title: news.title,
      category: news.category,
      status: news.status,
      publishedAt: news.publishedAt,
      updatedAt: news.updatedAt,
      submittedByName: authUsers.name,
    })
    .from(news)
    .leftJoin(authUsers, eq(authUsers.id, news.submittedByUserId))
    .orderBy(desc(news.updatedAt));
}

/** Una story completa + sus jugadores etiquetados, en la forma que ya espera
 * `NewsForm` — antes vivía inline en app/admin/(panel)/news/[id]/page.tsx, extraído
 * para poder pedirla bajo demanda desde el cliente al abrir un registro concreto
 * (components/admin/sections/NewsSection.tsx), sin traer el cuerpo de TODAS las
 * noticias de golpe solo para enseñar la lista. */
export async function getNewsForEdit(id: number): Promise<NewsFormValues | null> {
  await requireAdmin();
  if (!Number.isInteger(id)) return null;

  const [[story], tags] = await Promise.all([
    db.select().from(news).where(eq(news.id, id)),
    db.select({ playerId: newsPlayers.playerId }).from(newsPlayers).where(eq(newsPlayers.newsId, id)),
  ]);
  if (!story) return null;

  return {
    id: story.id,
    title: story.title,
    excerpt: story.excerpt,
    body: story.body,
    author: story.author ?? "",
    category: story.category,
    imageUrl: story.imageUrl ?? "",
    editionId: story.editionId,
    published: story.status === "published",
    playerIds: tags.map((t) => t.playerId),
  };
}

export interface SaveNewsOutcome {
  error: string | null;
}

/**
 * Ya no redirige — pedido explícito del propietario de absorber el panel entero
 * dentro de /account, donde no hay una ruta propia a la que volver. El componente
 * que llama a esto (components/admin/NewsForm.tsx) decide qué hacer al ver
 * `error: null`, normalmente volver a la vista de lista.
 */
export async function saveNews(formData: FormData): Promise<SaveNewsOutcome> {
  await requireAdmin();

  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? Number(idRaw) : null;

  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  // Saneado en el servidor, nunca en confianza del HTML que mande el cliente — ver el
  // comentario de sanitizeRichText (lib/richText.ts). isRichTextEmpty en vez de un
  // simple `!body`: components/admin/RichTextEditor.tsx nunca manda un string
  // realmente vacío, un documento vacío en Tiptap sigue siendo `<p></p>`.
  const body = sanitizeRichText(String(formData.get("body") ?? ""));
  const author = String(formData.get("author") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "REPORT");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const editionRaw = String(formData.get("editionId") ?? "").trim();
  const editionId = editionRaw ? Number(editionRaw) : null;
  const publish = formData.get("publish") === "on";
  const playerIds = parsePlayerIds(String(formData.get("playerIds") ?? ""));

  if (!title || !excerpt || isRichTextEmpty(body)) {
    return { error: "Headline, standfirst, and body are all required." };
  }

  const status = publish ? "published" : "draft";
  const values = {
    title,
    excerpt,
    body,
    author,
    category: (NEWS_CATEGORIES as readonly string[]).includes(category) ? category : "REPORT",
    imageUrl,
    editionId: editionId && Number.isInteger(editionId) ? editionId : null,
    status,
    updatedAt: new Date(),
  };

  let newsId: number;
  if (id) {
    const [existing] = await db.select().from(news).where(eq(news.id, id));
    if (!existing) return { error: "This story no longer exists." };
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
  revalidatePath("/account");
  for (const playerId of playerIds) revalidatePath(`/players/${playerId}`);

  return { error: null };
}

export interface DeleteNewsOutcome {
  error: string | null;
}

export async function deleteNews(id: number): Promise<DeleteNewsOutcome> {
  await requireAdmin();
  if (!Number.isInteger(id)) return { error: "Invalid story." };

  await db.delete(news).where(eq(news.id, id));

  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/account");
  return { error: null };
}
