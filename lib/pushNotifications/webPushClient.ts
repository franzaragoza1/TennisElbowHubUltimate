import webpush from "web-push";

let configured = false;

/**
 * `null` cuando las tres variables VAPID no están puestas — el sitio entero (bandeja de
 * notificaciones incluida) sigue funcionando sin ellas, ver .env.example. Configura
 * `webpush` una sola vez por proceso, no en cada envío.
 */
export function getWebPushClient(): typeof webpush | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return webpush;
}
