// Service worker dedicado a push — nada de caché offline aquí, esto no es una PWA
// completa, solo lo mínimo que el navegador exige para poder recibir "push" en segundo
// plano y reaccionar a un click sobre el aviso. `no-cache` en next.config.ts evita que
// un navegador se quede pegado a una versión vieja de este fichero entre despliegues.

self.addEventListener("push", (event) => {
  let payload = { title: "XKT Tour", body: "", href: "/" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || undefined,
      icon: "/assets/icons/icon-192.png",
      badge: "/assets/icons/icon-192.png",
      data: { href: payload.href || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data && event.notification.data.href ? event.notification.data.href : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).pathname === href && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(href);
      return undefined;
    }),
  );
});
