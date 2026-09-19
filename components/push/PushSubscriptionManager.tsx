"use client";

import { useEffect } from "react";
import { isPushSupported } from "@/lib/pushNotifications/browserSubscribe";

/**
 * Sin interfaz propia — solo registra `/sw.js` en cuanto carga cualquier página, para
 * que ya esté listo cuando el usuario pulse "Enable notifications" en el desplegable de
 * NotificationBell (el control de verdad vive ahí, no aquí). Registrar no pide permiso
 * ni crea ninguna suscripción por su cuenta — un service worker registrado sin permiso
 * de notificación no puede recibir nada.
 */
export function PushSubscriptionManager() {
  useEffect(() => {
    if (!isPushSupported()) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker no hay push — el resto del sitio sigue funcionando igual.
    });
  }, []);

  return null;
}
