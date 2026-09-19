"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { getMyRecentNotifications, markAllNotificationsRead } from "@/app/notifications/actions";
import {
  disablePushNotifications,
  enablePushNotifications,
  getExistingPushSubscription,
  isPushSupported,
} from "@/lib/pushNotifications/browserSubscribe";
import type { NotificationRow } from "@/lib/notifications";

// Deliberadamente DISTINTO de los 60s de lib/liveTennis/useLiveScores.ts (auditoría
// de rendimiento, 2026-09-19): en cualquier página que monte los dos a la vez
// (cualquiera, para un usuario logueado, ya que la campana vive en el layout raíz),
// los dos sondeos caían casi siempre en el mismo segundo. El push (fase 3 del plan
// de notificaciones) ya cubre la entrega en tiempo real de verdad — este sondeo es
// solo el respaldo para quien no activó push o está en una pestaña sin él, así que no
// hace falta que compita con el de partidos en vivo.
const POLL_INTERVAL_MS = 90_000;

type PushState = "unknown" | "unsupported" | "off" | "on" | "denied";

function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/**
 * La campana en sí solo aparece con sesión iniciada — sin cuenta no hay bandeja que
 * mostrar. El control de activar/desactivar push vive aquí (no en
 * PushSubscriptionManager, que solo registra el service worker en silencio en
 * app/layout.tsx) porque es donde tiene sentido para quien lo usa: junto al resto de
 * notificaciones, no como un aviso aparte.
 */
export function NotificationBell() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [pushState, setPushState] = useState<PushState>("unknown");
  const [pushPending, setPushPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Función anidada dentro del efecto, no un `useCallback` externo — mismo patrón
  // exacto que lib/liveTennis/useLiveScores.ts: así el `await fetch` interno queda
  // fuera del cuerpo síncrono del efecto, y llamar a `poll()` aquí no dispara
  // react-hooks/set-state-in-effect (el `setUnreadCount` real ocurre tras el await).
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/notifications/unread-count");
        const data = (await res.json()) as { count: number };
        if (!cancelled) setUnreadCount(data.count);
      } catch {
        // deja el último valor conocido — el próximo ciclo ya reintenta solo
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") poll();
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getMyRecentNotifications()
      .then((rows) => {
        if (!cancelled) setNotifications(rows);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });
    markAllNotificationsRead()
      .then(() => {
        if (!cancelled) setUnreadCount(0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!session?.user) return;
    if (!isPushSupported()) {
      // Detección de soporte del navegador — igual que MatchLogReminderToast.tsx
      // sincronizando con sessionStorage: no existe forma de leer esto sin un efecto,
      // ni de posponer el resultado a un `.then()` porque no hay nada async que esperar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    getExistingPushSubscription().then((sub) => setPushState(sub ? "on" : "off"));
  }, [session, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!session?.user) return null;

  async function togglePush() {
    setPushPending(true);
    if (pushState === "on") {
      await disablePushNotifications();
      setPushState("off");
    } else {
      const result = await enablePushNotifications();
      setPushState(result.ok ? "on" : Notification.permission === "denied" ? "denied" : "off");
    }
    setPushPending(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="bg-accent-500 text-navy-900 absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // `fixed inset-x-4` en móvil, `absolute right-0` desde `sm:` — mismo motivo y
        // mismos números exactos que components/nav/SearchBar.tsx: el ancla (el propio
        // botón de la campana, `h-9 w-9`) no vive pegada al borde derecho real de la
        // pantalla en móvil (a su derecha siguen el tema, la búsqueda...), así que un
        // panel de ancho fijo (`w-80`) creciendo en `absolute right-0` desde ESE ancla
        // se salía por el borde IZQUIERDO de la pantalla (bug real, reportado con
        // captura: el texto aparecía cortado a la izquierda). `top-[7.5rem]` = las dos
        // franjas fijas de la cabecera en móvil (BrandBar hero 64px + la fila de nav
        // 56px).
        <div className="animate-in fade-in slide-in-from-top-2 border-rule/20 fixed inset-x-4 top-[7.5rem] z-50 overflow-hidden rounded-lg border bg-navy-800 shadow-xl duration-200 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 sm:origin-top-right">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-eyebrow text-xs text-white">Notifications</p>
            {pushState !== "unsupported" && (
              <button
                type="button"
                onClick={togglePush}
                disabled={pushPending || pushState === "denied"}
                className="text-eyebrow text-[10px] text-white/60 hover:text-white disabled:opacity-50"
              >
                {pushState === "on" ? "Disable push" : pushState === "denied" ? "Push blocked" : "Enable push"}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications === null && <p className="text-muted-label px-4 py-8 text-center text-sm">Loading…</p>}
            {notifications?.length === 0 && <p className="text-muted-label px-4 py-8 text-center text-sm">Nothing yet.</p>}
            {notifications?.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`block border-b border-white/5 px-4 py-3 transition-colors duration-150 last:border-0 hover:bg-white/5 ${
                  n.readAt ? "" : "bg-white/5"
                }`}
              >
                <p className="text-sm font-medium text-white">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{n.body}</p>}
                <p className="text-muted-label mt-1 text-[10px]">{formatDate(n.createdAt)}</p>
              </Link>
            ))}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-eyebrow block border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-white/60 hover:bg-white/5 hover:text-white"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
