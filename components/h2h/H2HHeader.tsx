import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { CountryFlag } from "@/components/rankings/CountryFlag";

export interface H2HPlayerInfo {
  id: number;
  displayName: string;
  country: string | null;
  avatarUrl: string | null;
  currentRank: number | null;
  currentPoints: number | null;
  careerHigh: number | null;
  proSince: number | null;
}

const SIDE_COLOR = { left: "var(--blue-500)", right: "var(--accent-500)" } as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-eyebrow text-[11px] text-white/50">{label}</dt>
      <dd className="tour-numeric text-headline text-sm text-white">{value}</dd>
    </div>
  );
}

/**
 * `compact` — pedido explícito (2026-09-17): "cant u just makes the things inside
 * smaller and more centered" sobre el módulo de `/players`. `flex-1` +
 * `justify-between` (el modo normal, para `/h2h` a toda página) reparte el ANCHO
 * disponible en dos mitades iguales sin más — con avatares más pequeños dentro de esas
 * mismas mitades, el resultado es más hueco vacío en los bordes, no un panel más
 * compacto. En modo compacto los paneles dejan de crecer (`flex-1` fuera) y la fila
 * entera pasa a `justify-center` con un hueco fijo (ver `H2HHeader` más abajo) — así
 * el contenido se agrupa hacia el centro en vez de estirarse a llenar el ancho, sea
 * cual sea ese ancho. Por eso también deja de hacer falta la alineación por lado
 * (`items-end`/`items-start`, pensada para tirar el contenido hacia el centro DENTRO
 * de una mitad que sí crece) — con paneles que ya no crecen, `items-center` a secas
 * hace lo mismo.
 */
function PlayerPanel({ player, align, compact = false }: { player: H2HPlayerInfo; align: "left" | "right"; compact?: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-4 ${
        compact ? "" : `flex-1 ${align === "left" ? "@min-[650px]:items-end" : "@min-[650px]:items-start"}`
      }`}
    >
      {/* `min-w-0` en cascada hasta el nombre (que sí trunca) — sin esto un flex item
       * nunca encoge por debajo del ancho intrínseco de su contenido (comportamiento
       * por defecto de flexbox, `min-width: auto`). Mismo `@min-[650px]:` que el breakpoint de
       * fila/columna de arriba (H2HHeader) en vez de `sm:` — bug real reportado,
       * 2026-09-17: ver el comentario largo ahí. */}
      <div
        className={`flex min-w-0 max-w-full flex-col items-center gap-3 @min-[650px]:flex-row ${
          align === "right" ? "@min-[650px]:flex-row-reverse" : ""
        }`}
      >
        <PlayerAvatar
          displayName={player.displayName}
          country={player.country}
          avatarUrl={player.avatarUrl}
          size={compact ? "md" : "lg"}
          onDarkSurface
        />
        <Link
          href={`/players/${player.id}`}
          style={{ backgroundColor: SIDE_COLOR[align] }}
          className="text-headline flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-navy-900 transition-opacity hover:opacity-90"
        >
          <span className="h-4 w-5 shrink-0 overflow-hidden rounded-sm bg-white/40">
            <CountryFlag country={player.country} className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 truncate text-base">{player.displayName}</span>
        </Link>
      </div>
      <dl
        className={`w-full space-y-2 rounded-lg border border-white/10 bg-white/5 ${compact ? "max-w-48 p-3" : "max-w-60 p-4"}`}
      >
        <Row label="Ranking" value={player.currentRank ? `#${player.currentRank}` : "—"} />
        <Row
          label="Points"
          value={player.currentPoints !== null ? player.currentPoints.toLocaleString("en-US") : "—"}
        />
        <Row label="Career high" value={player.careerHigh ? `#${player.careerHigh}` : "—"} />
        <Row label="Playing since" value={player.proSince ? String(player.proSince) : "—"} />
      </dl>
    </div>
  );
}

/** Punto sobre la circunferencia para un ángulo en grados, con 0° = arriba (12 en
 * punto) y positivo = sentido horario — de ahí que el aro ya no necesite ningún
 * `-rotate-90` en el `<svg>`, el ángulo ya está medido desde arriba. */
function pointOnCircle(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Arco de `startDeg` a `endDeg` (puede ir en cualquier sentido, `endDeg` menor que
 * `startDeg` = sentido antihorario). */
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = pointOnCircle(cx, cy, r, startDeg);
  const end = pointOnCircle(cx, cy, r, endDeg);
  const sweep = endDeg >= startDeg ? 1 : 0;
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

/**
 * Aro proporcional al reparto de victorias (azul/lima, un color por jugador) — no solo
 * un círculo decorativo: la porción de arco de cada color es su cuota real de
 * victorias en el enfrentamiento. Sin enfrentamientos todavía, el aro sale neutro (gris),
 * no partido 50/50 de forma inventada.
 *
 * Los dos arcos arrancan juntos arriba y crecen cada uno hacia SU lado — el azul
 * (jugador 1, panel de la izquierda) en sentido antihorario, hacia la izquierda; el
 * lima (jugador 2, panel de la derecha) en sentido horario, hacia la derecha — y se
 * encuentran donde toque según el reparto real. Antes los dos colores arrancaban del
 * mismo punto pero AMBOS hacia el mismo lado (uno tapando al otro, dibujados con
 * `<circle>` + `stroke-dasharray`, sensible al sentido de barrido implícito del
 * navegador) — con datos reales (5-2) la porción lima acababa cerca del panel
 * izquierdo, del lado del jugador que NO es lima, en vez de hacia su propio panel.
 * Con trazado explícito por coordenadas (`describeArc`) el sentido de cada arco es
 * un dato, no una suposición sobre cómo pinta `<circle>` el navegador.
 */
function WinRatioRing({ player1Wins, player2Wins }: { player1Wins: number; player2Wins: number }) {
  const total = player1Wins + player2Wins;
  const radius = 52;
  const p1Deg = total > 0 ? (360 * player1Wins) / total : 0;
  const p2Deg = total > 0 ? (360 * player2Wins) / total : 0;

  return (
    <svg viewBox="0 0 120 120" className="animate-in fade-in absolute inset-0 h-full w-full duration-500">
      <circle cx={60} cy={60} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={6} />
      {total > 0 && (
        <>
          {player1Wins > 0 && (
            <path
              className="arc-draw"
              pathLength={100}
              d={describeArc(60, 60, radius, 0, -p1Deg)}
              fill="none"
              stroke={SIDE_COLOR.left}
              strokeWidth={6}
              strokeLinecap="round"
            />
          )}
          {player2Wins > 0 && (
            <path
              className="arc-draw"
              pathLength={100}
              d={describeArc(60, 60, radius, 0, p2Deg)}
              fill="none"
              stroke={SIDE_COLOR.right}
              strokeWidth={6}
              strokeLinecap="round"
            />
          )}
        </>
      )}
    </svg>
  );
}

export function H2HHeader({
  player1,
  player2,
  player1Wins,
  player2Wins,
  compact = false,
}: {
  player1: H2HPlayerInfo;
  player2: H2HPlayerInfo;
  player1Wins: number;
  player2Wins: number;
  /** El módulo reducido de `/players` (components/players/PlayersH2HCompare.tsx) —
   * ver el comentario largo en `PlayerPanel` sobre por qué esto necesita más que solo
   * tamaños más pequeños: `justify-center` con un hueco fijo en vez de
   * `justify-between` con paneles que crecen es lo que de verdad agrupa todo hacia el
   * centro. `/h2h` (la ficha de detalle a toda página) sigue sin pasar esta prop. */
  compact?: boolean;
}) {
  return (
    <div className="bg-navy-900">
      {/* `@container` + `@min-[650px]:` en vez de `sm:` — bug real reportado (2026-09-17):
       * este mismo header, embebido en `/players` (components/players/PlayersH2HCompare.tsx)
       * junto al sidebar de 320px, se desbordaba en fila a partir de 640px de VIEWPORT
       * aunque el espacio real disponible en su columna fuera mucho menor (medido con
       * Playwright: 178px de desbordamiento real a 1024px de ancho de pantalla). Un
       * breakpoint de contenedor reacciona al ancho de verdad disponible aquí dentro, no
       * al del viewport entero — en `/h2h` (ancho completo, sin sidebar) sigue pasando a
       * fila en cuanto hay sitio, exactamente igual que antes.
       *
       * 650px, no 750px — la condición de un `@container` se mide contra el CONTENT-BOX
       * del propio contenedor (con su padding-inline ya descontado), no contra el
       * border-box que devuelve `getBoundingClientRect` (confirmado a mano: con este
       * mismo `div` midiendo 752px de border-box en `/players` — el techo real de esa
       * columna en cualquier pantalla ≥1200px, por el `max-width` de la rejilla exterior
       * — un umbral de "750px" nunca se cumplía, porque su content-box real son
       * 752-96(padding de `lg:`)=656px. El desbordamiento de verdad (forzando la fila a
       * mano con Playwright) empieza justo por debajo de esos ~656px de espacio
       * disponible, así que 650px de CONTENT-BOX es el número que hay que comparar, no
       * un border-box a ojo. Pedido explícito, 2026-09-17: "it shouldnt be vertical" a
       * ese mismo ancho de columna (~760px de viewport visible, 656px de espacio real
       * para el contenido) — con 650px ya pasa a fila ahí. */}
      <div className={`tour-container @container ${compact ? "py-6" : "py-10"}`}>
        <div
          className={`flex flex-col items-center @min-[650px]:flex-row @min-[650px]:items-start ${
            compact ? "gap-6 @min-[650px]:justify-center @min-[650px]:gap-10" : "gap-8 @min-[650px]:justify-between"
          }`}
        >
          <div className="animate-in fade-in slide-in-from-left-2 duration-500">
            <PlayerPanel player={player1} align="left" compact={compact} />
          </div>
          <div
            className={`animate-in fade-in zoom-in-95 flex shrink-0 items-center delay-150 duration-500 @min-[650px]:mt-6 ${compact ? "gap-4" : "gap-6"}`}
          >
            <span className={`tour-numeric text-headline text-white ${compact ? "text-2xl" : "text-4xl"}`}>{player1Wins}</span>
            <div
              className={`relative flex shrink-0 items-center justify-center rounded-full text-center ${compact ? "h-20 w-20" : "h-28 w-28"}`}
            >
              <WinRatioRing player1Wins={player1Wins} player2Wins={player2Wins} />
              <span className="text-eyebrow text-[11px] text-white/80">
                Vs
                <br />
                wins
              </span>
            </div>
            <span className={`tour-numeric text-headline text-white ${compact ? "text-2xl" : "text-4xl"}`}>{player2Wins}</span>
          </div>
          <div className="animate-in fade-in slide-in-from-right-2 duration-500">
            <PlayerPanel player={player2} align="right" compact={compact} />
          </div>
        </div>
      </div>
    </div>
  );
}
