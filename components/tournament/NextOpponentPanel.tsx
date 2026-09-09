"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { formatRemainingTime } from "@/lib/formatRemainingTime";
import { PARTNER_LINKS } from "@/lib/partnerLinks";
import type { NextOpponentResult, OpponentInfo } from "@/lib/nextOpponent";

const DISCORD_INVITE_URL = PARTNER_LINKS.find((l) => l.id === "discord")!.href;

function formatDeadlineUtc(deadlineAt: Date): string {
  return (
    deadlineAt.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
}

/**
 * Recuento en vivo — se recalcula cada minuto en el cliente para que "remaining time
 * to play" no se quede congelado en el valor del primer render (pedido explícito:
 * "deadline always UTC + remaining time to play"). Componente aparte solo por esto:
 * el resto del panel es estático una vez cargado.
 */
function RemainingTime({ deadlineAt }: { deadlineAt: Date }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // A propósito: sin esto el contador se queda vacío hasta el primer tick del
    // intervalo (60s) — el mismo motivo que ya justifica este patrón en
    // BracketColumns.tsx (medir tras montar, nunca en el render del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Primer render (servidor + hidratación) sin `now` real, a propósito: "ahora mismo"
  // depende del reloj del visitante, y calcularlo en el servidor desincronizaría el
  // HTML con lo que hidrata el cliente (mismo motivo que otros relojes en vivo del
  // sitio). Un instante en blanco es preferible a un valor que salte al hidratar.
  if (!now) return null;

  const overdue = deadlineAt.getTime() < now.getTime();
  return <span className={overdue ? "text-down" : "text-ink"}>{formatRemainingTime(deadlineAt, now)}</span>;
}

/** `dark` para el fondo navy de la tarjeta de campeón — nunca se intenta forzar el
 * color desde fuera con un selector tipo `[&_a]:...` (ese pulso de especificidad ya
 * salió mal una vez de verdad, ver docs/decisiones.md: un `bg-black` pasado por
 * className no siempre gana al `bg-transparent` de base de un componente). Más simple
 * y más fiable: el propio componente decide sus clases según la variante. */
function OpponentRow({ opponent, dark = false }: { opponent: OpponentInfo; dark?: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <PlayerAvatar
        displayName={opponent.displayName}
        country={opponent.country}
        avatarUrl={opponent.avatarUrl}
        size="lg"
        onDarkSurface={dark}
      />
      <div className="min-w-0">
        <Link
          href={`/players/${opponent.playerId}`}
          className={`text-headline block text-lg hover:underline ${dark ? "text-white" : "text-ink"}`}
        >
          {opponent.displayName}
        </Link>
        <div className="mt-1 flex flex-wrap gap-3">
          {opponent.manaProfileUrl && (
            <a
              href={opponent.manaProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-eyebrow text-xs hover:underline ${dark ? "text-accent-500" : "text-blue-500"}`}
            >
              Mana Games profile
            </a>
          )}
          {opponent.discordProfileUrl && (
            <a
              href={opponent.discordProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-eyebrow text-xs hover:underline ${dark ? "text-accent-500" : "text-blue-500"}`}
            >
              Discord profile
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Vive en la propia ficha de torneo (`/tournaments/[id]`), no en `/account` (pedido
 * explícito) — el nombre del torneo ya lo enseña la cabecera de esa página, así que
 * aquí solo hace falta la ronda.
 */
export function NextOpponentPanel({ info }: { info: NextOpponentResult }) {
  if (info.status === "none") return null;

  const roundLabel = roundDisplayLabel(fullRoundLadder(info.drawSize), info.round);

  if (info.status === "tbd") {
    return (
      <div className="mb-6 rounded-lg border border-rule bg-paper p-5">
        <h2 className="text-headline mb-1 text-lg text-ink">Next opponent</h2>
        <p className="text-muted-label mb-4 text-xs">{roundLabel}</p>
        <p className="text-muted-label rounded-md border border-rule bg-paper-tint px-4 py-6 text-center text-sm italic">
          Next opponent: TBD — waiting for the other side of this round to be decided.
        </p>
      </div>
    );
  }

  if (info.status === "eliminated") {
    return (
      <div className="mb-6 rounded-lg border border-rule bg-paper p-5">
        <h2 className="text-headline mb-1 text-lg text-ink">You lost to:</h2>
        <p className="text-muted-label mb-4 text-xs">{roundLabel}</p>
        <OpponentRow opponent={info.opponent} />
        {info.scoreRaw && <p className="tour-numeric text-muted-label text-xs">{info.scoreRaw}</p>}
      </div>
    );
  }

  if (info.status === "champion") {
    return (
      <div className="mb-6 rounded-lg bg-navy-900 p-6 text-center">
        <p className="text-4xl" aria-hidden="true">
          🏆
        </p>
        <h2 className="text-headline mt-2 text-2xl text-accent-500">Champion</h2>
        <p className="mt-1 mb-5 text-sm text-white/80">Congratulations! You won the tournament.</p>
        <div className="mx-auto flex max-w-xs justify-center">
          <OpponentRow opponent={info.winner} dark />
        </div>
        {info.scoreRaw && (
          <p className="tour-numeric mt-2 text-xs text-white/60">
            Defeated {info.runnerUpName}, {info.scoreRaw}
          </p>
        )}
      </div>
    );
  }

  const deadline = info.deadlineAt ? new Date(info.deadlineAt) : null;

  return (
    <div className="mb-6 rounded-lg border border-rule bg-paper p-5">
      <h2 className="text-headline mb-1 text-lg text-ink">Next opponent</h2>
      <p className="text-muted-label mb-4 text-xs">{roundLabel}</p>
      <OpponentRow opponent={info.opponent} />

      {deadline ? (
        <div className="rounded-md border border-rule bg-paper-tint px-4 py-3">
          <p className="text-eyebrow text-[10px] text-muted-label">Deadline</p>
          <p className="text-headline tour-numeric text-sm text-ink">{formatDeadlineUtc(deadline)}</p>
          <p className="tour-numeric text-xs">
            <RemainingTime deadlineAt={deadline} />
          </p>
        </div>
      ) : (
        <p className="text-muted-label rounded-md border border-rule bg-paper-tint px-4 py-3 text-xs">
          No deadline published for this round yet.
        </p>
      )}

      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="tap-scale text-eyebrow mt-4 flex items-center justify-center rounded-full border border-rule px-5 py-2.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        Request Extension
      </a>
    </div>
  );
}
