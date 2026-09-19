import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { getWebPushClient } from "./webPushClient";

export interface PushPayload {
  title: string;
  body?: string | null;
  href: string;
}

/**
 * Entrega best-effort sobre una fila de `notifications` ya escrita (esa fila, no esto,
 * es la fuente de verdad — ver el comentario de `notifications` en db/schema.ts). Nunca
 * lanza más allá de su propio límite: un fallo de red, un 5xx del servicio push del
 * navegador, o VAPID sin configurar, todo se traga aquí sin más.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const webpush = getWebPushClient();
  if (!webpush) return;

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        await db.update(pushSubscriptions).set({ lastSeenAt: new Date() }).where(eq(pushSubscriptions.id, sub.id));
      } catch (err) {
        // 404/410 = el navegador ya no reconoce este endpoint (desinstalado, permiso
        // revocado) — se borra la suscripción para no reintentar nunca contra ella.
        // Cualquier otro fallo (red, 5xx puntual) se ignora sin más: no hay reintento.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }),
  );
}
