"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { dismissMatchLogReminder } from "@/app/account/actions";

const SESSION_DISMISS_KEY = "matchlog-reminder-dismissed";

/**
 * Antes era una píldora fija en SiteNav ("small bug here" nunca reportado, pero se
 * perdía entre el resto de botones de la barra en pantallas estrechas) — pedido
 * explícito: un popup flotante en la esquina, imposible de no ver. Vive en
 * app/layout.tsx junto a SiteNav, no dentro de ella, porque no tiene nada que ver con
 * la navegación en sí.
 *
 * Dos formas de que deje de aparecer, con alcance muy distinto:
 * - La "×" solo lo oculta para esta pestaña/sesión de navegador (`sessionStorage`) —
 *   vuelve a aparecer la próxima vez que se entre al sitio, si sigue overdue.
 * - "I'm not on PC, stop reminding me" es permanente y por cuenta
 *   (`dismissMatchLogReminder`, ver db/schema.ts::authUsers.matchLogReminderOptedOut)
 *   — para quien de verdad no puede subir un MatchLog nunca (juega en otro sitio), no
 *   tiene sentido que vuelva a preguntar en otro dispositivo ni el mes que viene.
 */
export function MatchLogReminderToast() {
  const { data: session } = useSession();
  const [overdue, setOverdue] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      // Sincroniza con `sessionStorage`, un sistema externo real — no hay forma de
      // leerlo sin un efecto, mismo caso que el desplegable de SiteNav.tsx.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissedThisSession(sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");
    } catch {
      // Navegación privada u otro bloqueo de almacenamiento — se comporta como si no
      // se hubiera cerrado nunca, no rompe nada.
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/account/match-log/reminder")
      .then((res) => res.json())
      .then((data) => setOverdue(Boolean(data?.overdue)))
      .catch(() => setOverdue(false));
  }, [session]);

  // `session?.user` se comprueba aquí, no reseteando `overdue` a mano al cerrar
  // sesión — evita un setState síncrono dentro del efecto de arriba (la última
  // respuesta se queda en memoria, pero nunca se enseña sin sesión real).
  if (!overdue || dismissedThisSession || !session?.user) return null;

  function dismissForSession() {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // Sin almacenamiento disponible: se cierra igual para esta vista, solo que
      // volverá a aparecer si la página se recarga.
    }
    setDismissedThisSession(true);
  }

  function optOutForGood() {
    setDismissedThisSession(true);
    startTransition(async () => {
      await dismissMatchLogReminder();
    });
  }

  return (
    <div
      role="status"
      className="animate-in fade-in slide-in-from-bottom-4 fixed right-4 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-white/10 bg-navy-900 p-4 shadow-xl duration-300 sm:right-6 sm:bottom-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-headline text-sm text-white">Upload your MatchLog</p>
        <button
          type="button"
          onClick={dismissForSession}
          aria-label="Dismiss"
          className="text-muted-label -mt-1 -mr-1 shrink-0 rounded-md p-1 text-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          ✕
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/70">
        It&apos;s been a while since your last upload — attach your real match stats to your profile.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Link
          href="/account"
          onClick={dismissForSession}
          className="text-eyebrow tap-scale rounded-full bg-accent-500 px-4 py-2 text-[11px] text-navy-900 hover:brightness-95"
        >
          Upload now
        </Link>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
        <input
          type="checkbox"
          disabled={isPending}
          onChange={(e) => e.target.checked && optOutForGood()}
          className="h-3.5 w-3.5"
        />
        I&apos;m not on PC, stop reminding me
      </label>
    </div>
  );
}
