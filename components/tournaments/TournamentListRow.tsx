import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";
import { getTournamentLogoUrl } from "@/lib/tournamentLogos";
import { TournamentStatusBadge } from "./TournamentStatusBadge";
import type { TournamentCardData } from "./TournamentCard";

/** "YYYY-MM-DD" -> "Sep 21" (el año ya lo dice la temporada elegida). UTC a propósito, mismo
 * motivo que `formatStartDate` de TournamentCard. */
function shortDate(weekStartDate: string): string {
  return new Date(`${weekStartDate}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", day: "numeric", month: "short" });
}

/**
 * Vista compacta de `/tournaments` (pedido explícito, 2026-10-17): una fila por torneo en vez
 * de una tarjeta — la de por defecto para "Ongoing Now", y opcional (botón "Compact") para las
 * semanas. Mismos datos que la tarjeta; los nombres de jugador NUNCA se cortan con "…" (el
 * motivo de que la vista de tarjetas sea como es): si no caben, la fila crece en alto.
 */
export function TournamentListRow({ data, href, hideStatus = false }: { data: TournamentCardData; href?: string; hideStatus?: boolean }) {
  const logoUrl = getTournamentLogoUrl(data.eventName);
  const notYetOpen = data.status === "registration" && !data.hasOpenRegistrationQueue;

  const content = (
    <>
      <span aria-hidden="true" className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: data.surface ? surfaceColor(data.surface) : "var(--color-accent-500)" }} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- icono estático, igual que en TournamentCard
          <img src={logoUrl} alt="" className="h-8 w-8 object-contain" loading="lazy" decoding="async" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-headline block text-sm text-ink group-hover:text-blue-500">{data.eventName}</span>
        <span className="text-muted-label block text-xs">
          {data.surface ? `${data.category} · ${surfaceDisplayLabel(data.surface)}` : data.category}
          {data.weekStartDate ? ` · ${shortDate(data.weekStartDate)}` : data.isFinals ? " · Season Finale" : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right sm:max-w-[55%]">
        {notYetOpen ? (
          <span className="text-eyebrow text-[10px] text-muted-label">Not open yet</span>
        ) : data.championName ? (
          <>
            <span className="text-eyebrow text-[10px] text-muted-label">Champion</span>
            <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
              <CountryFlag country={data.championCountry} className="h-full w-full object-cover" />
            </span>
            <span className="text-headline text-sm text-ink">{data.championName}</span>
            {data.finalScore && <span className="tour-numeric text-muted-label text-xs">{data.finalScore}</span>}
          </>
        ) : data.status === "completed" ? (
          <span className="text-eyebrow text-[10px] text-muted-label">No final on record</span>
        ) : hideStatus ? null : (
          <TournamentStatusBadge status={data.status} />
        )}
      </span>
    </>
  );

  const rowClass = "group flex items-center gap-3 border-b border-rule px-3 py-2.5 last:border-0";
  if (notYetOpen) return <div className={rowClass}>{content}</div>;
  return (
    <Link
      href={href ?? `/tournaments/${data.editionId}`}
      prefetch={false}
      className={`${rowClass} transition-colors hover:bg-paper-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500`}
    >
      {content}
    </Link>
  );
}

/** El contenedor de una lista de filas. */
export function TournamentList({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-rule bg-paper">{children}</div>;
}

/** Botones de vista (enlaces reales: compartibles y con historial, mismo patrón que
 * StatGroupTabs). `options` = [valor, etiqueta, href]. */
export function ViewToggle({ label, current, options }: { label: string; current: string; options: [string, string, string][] }) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-full border border-rule bg-paper p-0.5 shadow-sm">
      {options.map(([value, text, href]) => (
        <Link
          key={value}
          href={href}
          scroll={false}
          aria-current={value === current ? "true" : undefined}
          className={`text-eyebrow rounded-full px-3 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
            value === current ? "bg-accent-500 text-navy-900" : "text-muted-label hover:text-ink"
          }`}
        >
          {text}
        </Link>
      ))}
    </div>
  );
}
