import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";
import { getTournamentLogoUrl } from "@/lib/tournamentLogos";
import { getTournamentHeaderUrl } from "@/lib/tournamentHeaders";
import type { TournamentTier } from "@/lib/tournamentTier";
import { TournamentStatusBadge } from "./TournamentStatusBadge";
import type { TournamentStatus } from "@/lib/tournamentStatus";
import { getImageProps } from "next/image";
import type { CSSProperties } from "react";

export interface TournamentCardData {
  editionId: number;
  /** El `Trn=` de Mana Games — `null` para las Tour Finals (no vienen de
   * `OT_ViewTournament.php`, ver `lib/finals/queries.ts`). Ya no se usa dentro de esta
   * misma tarjeta (el botón "Register now" vive en la ficha del torneo,
   * `app/tournaments/[id]/page.tsx`, desde el pase de la cola de inscripción,
   * 2026-09-18) — se deja aquí por si algún otro consumidor de esta forma lo necesita. */
  externalId: string | null;
  eventName: string;
  year: number;
  isoWeek: number | null;
  /** `editions.weekStartDate` ("YYYY-MM-DD") — el lunes real de inicio, ya resuelto
   * (scrapeado de Mana o puesto a mano al crear un torneo nativo, ver
   * `app/admin/native-tournaments/actions.ts`). `null` solo para Tour/Next Gen Finals
   * (`isFinals: true`, sin semana ISO real que resolver — ver
   * `components/finals/FinalsEditionCard.tsx`). Pedido explícito (2026-09-17): la
   * tarjeta enseñaba "2026 · Week 39", un número que nadie en la comunidad ubica sin
   * mirar un calendario ISO; el día real ("Sep 21, 2026") sí dice algo. */
  weekStartDate: string | null;
  /** `true` solo para Tour/Next Gen Finals — la única categoría de esta tarjeta sin
   * fecha de inicio real que mostrar, así que la línea de fecha cae a "Season Finale"
   * en vez de esconderse o mostrar un año pelado. */
  isFinals: boolean;
  /** `null` para eventos sin superficie real modelada. Tour/Next Gen Finals SÍ pasan
   * una (`"Indoor Concrete"`, fija — ver `components/finals/FinalsEditionCard.tsx`),
   * aunque `finalsEditions` no tenga columna propia para ella: en la vida real y en
   * TE4 son siempre indoor y siempre pista dura, así que no varía por edición. */
  surface: string | null;
  category: string;
  championId: number | null;
  championName: string | null;
  championCountry: string | null;
  runnerUpName: string | null;
  runnerUpCountry: string | null;
  finalScore: string | null;
  /** Derivado de `finalsEditions.status` para las Tour/Next Gen Finals (reusan esta
   * tarjeta pero no pasan por el cargador de torneos normal, ver
   * `components/finals/FinalsEditionCard.tsx`) — 'setup' antes de que arranque la fase
   * de grupos, 'ongoing' mientras esté en juego, 'completed' con campeón decidido. */
  status: TournamentStatus;
  /** Solo importa cuando `status === "registration"` — `true` cuando
   * `editions.queueCount` es un número real mayor que 0 (interés de inscripción de
   * verdad). Un torneo recién CREADO puede seguir en `"registration"` con `queueCount`
   * en 0 (o `null`) y aun así traer nombres sueltos en su propia cola (visto en datos
   * reales, Shanghai Masters 1000) — pedido explícito del propietario, 2026-09-18: esa
   * tarjeta sigue comportándose exactamente como antes (sin enlace propio), solo la que
   * tiene interés real pasa a enlazar a su ficha. `false` para Tour/Next Gen Finals
   * (nunca están en "registration"). */
  hasOpenRegistrationQueue: boolean;
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
 * Pase visual (2026-10-11): las tarjetas viven en una rejilla (`TOURNAMENT_GRID`) en
 * vez de filas `flex-wrap` de anchos sueltos, que dejaban huecos a la derecha y una
 * tarjeta sola en la última fila. La jerarquía de tamaños se conserva: Grand Slam y
 * Masters 1000 ocupan DOS columnas, el resto una (`grid-flow-dense` rellena los huecos).
 * El nombre del campeón/finalista sigue en una sola línea (nunca hace crecer la
 * tarjeta en alto) y, si no cabe, se corta con "…" y el nombre entero en el `title`.
 */
const CARD_SPAN: Record<TournamentTier, string> = {
  large: "sm:col-span-2",
  "medium-large": "sm:col-span-2",
  medium: "",
  small: "",
};

/** Rejilla de tarjetas de torneo (home e índice de torneos). `pt-5`: sitio para que la
 * tarjeta crezca y suba al pasar el ratón sin tapar el encabezado de encima. */
export const TOURNAMENT_GRID =
  "grid grid-flow-dense grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] items-start gap-4 pt-5";

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

/** "YYYY-MM-DD" -> "Sep 21, 2026". `T00:00:00Z`/`timeZone: "UTC"` a propósito: sin
 * anclar a UTC explícito, `new Date("2026-09-21")` se interpreta como medianoche UTC
 * pero `toLocaleDateString` la formatea en la zona LOCAL del navegador, que en zonas
 * horarias negativas la corre al día de antes (20 de septiembre) — mismo criterio que
 * `RoundDeadlines.tsx`. */
function formatStartDate(weekStartDate: string): string {
  return new Date(`${weekStartDate}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** La foto de sede a tamaño de tarjeta, por el optimizador de imágenes de Next. */
function cardPhotoUrl(url: string): string {
  return getImageProps({ src: url, alt: "", width: 640, height: 360 }).props.src;
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
  // Sin cuadro que enseñar todavía Y sin interés real de inscripción (`queueCount`
  // en 0/null — un torneo recién CREADO, no necesariamente abierto de verdad, ver el
  // comentario de `hasOpenRegistrationQueue`): no hay nada real a lo que llevar
  // (CLAUDE.md: no se inventa nada). La tarjeta entera deja de ser un enlace; el único
  // sitio al que se puede mandar a alguien es la propia inscripción en el foro. Con
  // interés real (cola con gente de verdad), esta tarjeta pasa a comportarse como
  // cualquier otra: enlaza a su propia ficha, donde vive la cola (pedido explícito del
  // propietario, 2026-09-18).
  const showsAsNotYetOpen = data.status === "registration" && !data.hasOpenRegistrationQueue;

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
          {/* La foto se pone SOLO al pasar el ratón (`group-hover:` sobre la variable) y
           * a tamaño de tarjeta vía el optimizador de Next (640 px, WebP) — pase de
           * rendimiento, 2026-10-11: con `background-image` fijo (aunque con opacidad 0)
           * el navegador bajaba TODAS las fotos al cargar: 62 JPG de ~400 KB, 15 MB en
           * /tournaments, para enseñar como mucho una. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-hover:[background-image:var(--card-photo)] group-focus-visible:[background-image:var(--card-photo)]"
            style={{ "--card-photo": `url(${cardPhotoUrl(headerUrl)})` } as CSSProperties}
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
            {data.surface ? `${data.category} · ${surfaceDisplayLabel(data.surface)}` : data.category}
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
            {data.weekStartDate ? formatStartDate(data.weekStartDate) : data.isFinals ? "Season Finale" : data.year}
          </p>

          <div className={`mt-4 flex items-center gap-2 border-t border-rule pt-3 transition-colors ${hoverRule}`}>
            {showsAsNotYetOpen ? (
              // Pedido explícito del propietario, 2026-09-18: un torneo apenas CREADO
              // (`queueCount` 0/null, sin interés real todavía) no tiene registro
              // abierto de verdad todavía — "Register now" invitaría a inscribirse en
              // algo que ni siquiera admite inscripciones, aunque `status` siga siendo
              // "registration" (esa etiqueta describe la fase del torneo, no si ya
              // acepta gente).
              <span className={`text-eyebrow text-[10px] text-muted-label transition-colors ${hoverMuted}`}>Not open yet</span>
            ) : data.status === "registration" ? (
              // Interés real de inscripción (cola con gente de verdad) — la tarjeta ya
              // enlaza a su propia ficha (más abajo), donde vive "Register now"; aquí
              // solo el badge de estado, igual que "ongoing".
              <TournamentStatusBadge status={data.status} />
            ) : data.championName ? (
              <>
                <span className={`text-eyebrow shrink-0 text-[10px] text-muted-label transition-colors ${hoverMuted}`}>Champion</span>
                <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                  <CountryFlag country={data.championCountry} className="h-full w-full object-cover" />
                </span>
                <span title={data.championName} className={`text-headline min-w-0 truncate text-sm text-ink transition-colors ${hoverText}`}>{data.championName}</span>
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
                      <span title={data.runnerUpName} className={`min-w-0 truncate text-sm text-ink ${hoverText}`}>{data.runnerUpName}</span>
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

  if (showsAsNotYetOpen) {
    return <div className={`relative block overflow-hidden rounded-lg border border-rule bg-paper ${HOVER_GROW} ${CARD_SPAN[tier]}`}>{body}</div>;
  }

  return (
    <Link
      href={href ?? `/tournaments/${data.editionId}`}
      // Sin prefetch (pase de rendimiento, 2026-09-14) — la propia tarjeta entera es el
      // enlace, y `/tournaments` (y la home) pintan decenas de estas a la vez; mismo
      // motivo que el resto de enlaces repetidos ya arreglados ese día (H2H, jugador).
      prefetch={false}
      className={`relative block overflow-hidden rounded-lg border border-rule bg-paper ${HOVER_GROW} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${CARD_SPAN[tier]}`}
    >
      {body}
    </Link>
  );
}
