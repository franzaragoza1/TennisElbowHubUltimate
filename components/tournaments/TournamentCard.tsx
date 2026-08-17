import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { surfaceColor } from "@/lib/surfaceColors";
import { getTournamentLogoUrl } from "@/lib/tournamentLogos";
import { getTournamentHeaderUrl } from "@/lib/tournamentHeaders";
import type { TournamentTier } from "@/lib/tournamentTier";
import { TournamentStatusBadge } from "./TournamentStatusBadge";
import type { TournamentStatus } from "@/lib/tournamentStatus";
import { manaTournamentUrl } from "@/lib/mana/links";

export interface TournamentCardData {
  editionId: number;
  /** El `Trn=` de Mana Games — `null` para las Tour Finals (no vienen de
   * `OT_ViewTournament.php`, ver `lib/finals/queries.ts`). Hace falta para el botón
   * "Register Now" de un torneo todavía en inscripción: no hay ficha propia que
   * enseñar (sin cuadro no hay nada que reconstruir), así que se manda directo al
   * torneo real en el foro. */
  externalId: string | null;
  eventName: string;
  year: number;
  isoWeek: number | null;
  /** `null` para eventos sin superficie real modelada (las Tour Finals reusan esta
   * misma tarjeta — ver `components/finals/FinalsEditionCard.tsx` — y no tienen
   * `surface` en su esquema, así que no se inventa una). */
  surface: string | null;
  category: string;
  championId: number | null;
  championName: string | null;
  championCountry: string | null;
  runnerUpName: string | null;
  runnerUpCountry: string | null;
  finalScore: string | null;
  /** `"completed"` para las Tour Finals (reusan esta tarjeta pero no pasan por el
   * cargador de torneos, ver `lib/finals/queries.ts`) — nunca están "en inscripción". */
  status: TournamentStatus;
}

/**
 * Tarjeta de torneo con filete del color de la superficie de pista — que es un dato,
 * no decoración (CLAUDE.md §6). La comparten la home y el índice de torneos, donde
 * viven en filas por semana ordenadas de menor a mayor peso (los grandes, a la
 * derecha) — ver `app/tournaments/page.tsx`. El tamaño del cuadro se enseña solo en
 * la ficha del torneo (`/tournaments/[id]`), aquí ya no cabe otra cifra más.
 *
 * Dos crecidas a la vez al pasar el ratón, no una: la tarjeta entera crece y se
 * eleva (`scale-110`, una transformación visual, no ocupa más sitio en el documento),
 * y el escudo crece de verdad — `height`/`width` reales, no un `transform: scale` —
 * así que el propio flujo del documento le hace sitio (la fila de cabecera se hace
 * más alta) en vez de recortarlo (`overflow-hidden`) o superponerlo al título.
 *
 * El nombre del campeón/finalista nunca hace crecer la tarjeta EN ALTO: en `sm:` para
 * arriba es `min-w`, no `w`, y el nombre va en una sola línea (`whitespace-nowrap`) —
 * un nombre largo ensancha la tarjeta en vez de partirse en dos o tres líneas.
 */
const CARD_WIDTH: Record<TournamentTier, string> = {
  large: "max-sm:w-full sm:w-auto sm:min-w-[440px]",
  "medium-large": "max-sm:w-full sm:w-auto sm:min-w-[360px]",
  medium: "max-sm:w-full sm:w-auto sm:min-w-[280px]",
  small: "max-sm:w-full sm:w-auto sm:min-w-[224px]",
};

const TITLE_SIZE: Record<TournamentTier, string> = {
  large: "text-2xl",
  "medium-large": "text-xl",
  medium: "text-lg",
  small: "text-base",
};

const LOGO_SIZE: Record<TournamentTier, string> = {
  large: "h-14 w-14 group-hover:h-28 group-hover:w-28",
  "medium-large": "h-11 w-11 group-hover:h-24 group-hover:w-24",
  medium: "h-8 w-8 group-hover:h-20 group-hover:w-20",
  small: "h-7 w-7 group-hover:h-16 group-hover:w-16",
};

/** Misma crecida al pasar el ratón lleve o no a una ficha propia — que un torneo en
 * inscripción no sea clicable como tarjeta no significa que deje de reaccionar al
 * ratón, solo que lo que reacciona es el botón "Register now" de dentro, no toda la
 * tarjeta como enlace. */
const HOVER_GROW =
  "group transition-all duration-300 ease-out hover:z-20 hover:-translate-y-2 hover:scale-110 hover:border-blue-500 hover:shadow-2xl";

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 4H4v12h12v-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3h6v6M17 3l-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TournamentCard({
  data,
  tier = "small",
  href,
}: {
  data: TournamentCardData;
  tier?: TournamentTier;
  /** Por defecto enlaza a la ficha de torneo normal; las Tour Finals (que reusan esta
   * misma tarjeta) enlazan a `/finals/[id]` en su lugar. */
  href?: string;
}) {
  const logoUrl = getTournamentLogoUrl(data.eventName);
  const headerUrl = getTournamentHeaderUrl(data.eventName);
  const hasExpandedInfo = Boolean(data.runnerUpName || data.finalScore);
  // Sin cuadro que enseñar todavía — no hay ficha propia a la que llevar (CLAUDE.md:
  // no se inventa nada). La tarjeta entera deja de ser un enlace; el único sitio al
  // que se puede mandar a alguien es la propia inscripción en el foro.
  const isRegistrationOpen = data.status === "registration";

  // Con foto de sede (lib/tournamentHeaders.ts), el texto pasa a blanco al pasar el
  // ratón — la propia foto solo se enseña ahí (pedido explícito), así que antes del
  // hover la tarjeta sigue viéndose exactamente igual que sin foto.
  const hoverText = headerUrl ? "group-hover:text-white" : "";
  const hoverMuted = headerUrl ? "group-hover:text-white/70" : "";
  const hoverRule = headerUrl ? "group-hover:border-white/20" : "";

  const body = (
    <>
      {headerUrl && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
            style={{ backgroundImage: `url(${headerUrl})` }}
          />
          {/* Viñeta: oscuro real en los bordes, algo más claro en el centro — nunca
           * tan claro como para que el texto blanco de encima deje de leerse. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(120% 130% at 50% 20%, rgba(0,10,35,0.55) 0%, rgba(0,10,35,0.85) 65%, rgba(0,10,35,0.96) 100%)",
            }}
          />
        </>
      )}
      <div className="relative">
        <div className="h-1 rounded-t-lg" style={{ backgroundColor: data.surface ? surfaceColor(data.surface) : "var(--color-accent-500)" }} />
        <div className="p-4">
          <p className={`text-eyebrow text-[11px] text-muted-label transition-colors ${hoverMuted}`}>
            {data.surface ? `${data.category} · ${data.surface}` : data.category}
          </p>
          <div className="mt-1 flex items-start justify-between gap-2">
            <p
              className={`text-headline min-w-0 truncate text-ink transition-colors ${headerUrl ? hoverText : "group-hover:text-blue-500"} ${TITLE_SIZE[tier]}`}
            >
              {data.eventName}
            </p>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- icono estático, no vale la pena el pipeline de next/image
              <img
                src={logoUrl}
                alt=""
                className={`shrink-0 object-contain transition-[height,width] duration-300 ease-out ${LOGO_SIZE[tier]}`}
              />
            )}
          </div>
          <p className={`tour-numeric text-muted-label mt-0.5 text-xs transition-colors ${hoverMuted}`}>
            {data.year}
            {data.isoWeek ? ` · Week ${data.isoWeek}` : ""}
          </p>

          <div className={`mt-4 flex items-center gap-2 border-t border-rule pt-3 transition-colors ${hoverRule}`}>
            {isRegistrationOpen ? (
              data.externalId ? (
                <a
                  href={manaTournamentUrl(data.externalId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-eyebrow inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1.5 text-[10px] text-navy-900 hover:bg-accent-500/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  Register now
                  <ExternalLinkIcon />
                </a>
              ) : (
                <TournamentStatusBadge status={data.status} />
              )
            ) : data.championName ? (
              <>
                <span className={`text-eyebrow shrink-0 text-[10px] text-muted-label transition-colors ${hoverMuted}`}>Champion</span>
                <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                  <CountryFlag country={data.championCountry} className="h-full w-full object-cover" />
                </span>
                <span className={`text-headline whitespace-nowrap text-sm text-ink transition-colors ${hoverText}`}>{data.championName}</span>
              </>
            ) : data.status === "ongoing" ? (
              <TournamentStatusBadge status={data.status} />
            ) : (
              <span className={`text-eyebrow text-[10px] text-muted-label transition-colors ${hoverMuted}`}>No final on record</span>
            )}
          </div>

          {hasExpandedInfo && (
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <div
                  className={`mt-3 flex items-center gap-2 border-t border-rule pt-3 opacity-0 transition-[opacity,color] delay-75 duration-200 group-hover:opacity-100 ${hoverRule}`}
                >
                  {data.runnerUpName && (
                    <>
                      <span className={`text-eyebrow shrink-0 text-[10px] text-muted-label ${hoverMuted}`}>Runner-up</span>
                      <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                        <CountryFlag country={data.runnerUpCountry} className="h-full w-full object-cover" />
                      </span>
                      <span className={`whitespace-nowrap text-sm text-ink ${hoverText}`}>{data.runnerUpName}</span>
                    </>
                  )}
                  {data.finalScore && (
                    <span className={`tour-numeric text-muted-label ml-auto shrink-0 text-xs ${hoverMuted}`}>{data.finalScore}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isRegistrationOpen) {
    return <div className={`relative block overflow-hidden rounded-lg border border-rule bg-paper ${HOVER_GROW} ${CARD_WIDTH[tier]}`}>{body}</div>;
  }

  return (
    <Link
      href={href ?? `/tournaments/${data.editionId}`}
      className={`relative block overflow-hidden rounded-lg border border-rule bg-paper ${HOVER_GROW} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${CARD_WIDTH[tier]}`}
    >
      {body}
    </Link>
  );
}
