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

function PlayerPanel({ player, align }: { player: H2HPlayerInfo; align: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-4 ${
        align === "left" ? "@3xl:items-end" : "@3xl:items-start"
      }`}
    >
      {/* `min-w-0` en cascada hasta el nombre (que sí trunca) — sin esto un flex item
       * nunca encoge por debajo del ancho intrínseco de su contenido (comportamiento
       * por defecto de flexbox, `min-width: auto`). Mismo `@3xl:` que el breakpoint de
       * fila/columna de arriba (H2HHeader) en vez de `sm:` — bug real reportado,
       * 2026-09-17: ver el comentario largo ahí. */}
      <div
        className={`flex min-w-0 max-w-full flex-col items-center gap-3 @3xl:flex-row ${
          align === "right" ? "@3xl:flex-row-reverse" : ""
        }`}
      >
        <PlayerAvatar
          displayName={player.displayName}
          country={player.country}
          avatarUrl={player.avatarUrl}
          size="lg"
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
      <dl className="w-full max-w-60 space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
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
}: {
  player1: H2HPlayerInfo;
  player2: H2HPlayerInfo;
  player1Wins: number;
  player2Wins: number;
}) {
  return (
    <div className="bg-navy-900">
      {/* `@container` + `@3xl:` en vez de `sm:` — bug real reportado (2026-09-17): este
       * mismo header, embebido en `/players` (components/players/PlayersH2HCompare.tsx)
       * junto al sidebar de 320px, se desbordaba en fila a partir de 640px de VIEWPORT
       * aunque el espacio real disponible en su columna fuera mucho menor (medido con
       * Playwright: 178px de desbordamiento real a 1024px de ancho de pantalla). Un
       * breakpoint de contenedor reacciona al ancho de verdad disponible aquí dentro,
       * no al del viewport entero — en `/h2h` (ancho completo, sin sidebar) sigue
       * pasando a fila en cuanto hay sitio, exactamente igual que antes. */}
      <div className="tour-container py-10 @container">
        <div className="flex flex-col items-center gap-8 @3xl:flex-row @3xl:items-start @3xl:justify-between">
          <div className="animate-in fade-in slide-in-from-left-2 duration-500">
            <PlayerPanel player={player1} align="left" />
          </div>
          <div className="animate-in fade-in zoom-in-95 flex shrink-0 items-center gap-6 delay-150 duration-500 @3xl:mt-6">
            <span className="tour-numeric text-headline text-4xl text-white">{player1Wins}</span>
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full text-center">
              <WinRatioRing player1Wins={player1Wins} player2Wins={player2Wins} />
              <span className="text-eyebrow text-[11px] text-white/80">
                Vs
                <br />
                wins
              </span>
            </div>
            <span className="tour-numeric text-headline text-4xl text-white">{player2Wins}</span>
          </div>
          <div className="animate-in fade-in slide-in-from-right-2 duration-500">
            <PlayerPanel player={player2} align="right" />
          </div>
        </div>
      </div>
    </div>
  );
}
