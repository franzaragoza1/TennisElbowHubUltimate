"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { authUsers, newsReporterRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";

/** Aprueba una solicitud pendiente — la marca real que concede el permiso vive en
 * `authUsers.isReporter`, esta tabla solo lleva la cola de revisión (ver el
 * comentario de db/schema.ts::newsReporterRequests). */
export async function approveReporterRequest(formData: FormData): Promise<void> {
  await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  if (!Number.isInteger(requestId)) return;

  const [request] = await db.select().from(newsReporterRequests).where(eq(newsReporterRequests.id, requestId));
  if (!request || request.status !== "pending") return;

  await db.update(authUsers).set({ isReporter: true }).where(eq(authUsers.id, request.userId));
  await db.update(newsReporterRequests).set({ status: "approved", decidedAt: new Date() }).where(eq(newsReporterRequests.id, requestId));

  revalidatePath("/account");
}

export async function rejectReporterRequest(formData: FormData): Promise<void> {
  await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  if (!Number.isInteger(requestId)) return;
  await db.update(newsReporterRequests).set({ status: "rejected", decidedAt: new Date() }).where(eq(newsReporterRequests.id, requestId));
  revalidatePath("/account");
}

/** Quita el permiso directamente en `authUsers.isReporter` — nunca toca
 * `newsReporterRequests` (esa tabla es solo la cola de revisión de la solicitud
 * original, no un registro de si el permiso sigue vigente ahora). Revocar no borra
 * ninguna news ya publicada por ese reportero, solo le impide escribir una nueva. */
export async function revokeReporter(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) return;
  await db.update(authUsers).set({ isReporter: false }).where(eq(authUsers.id, userId));
  revalidatePath("/account");
}
