import Link from "next/link";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { H2HHeader } from "@/components/h2h/H2HHeader";
import { H2HPicker, type PlayerOption } from "@/components/h2h/H2HPicker";
import { loadH2HData } from "@/lib/h2hPage";
import { getLatestRankingWeek, getTopPlayers } from "@/lib/tourQueries";

/**
 * Módulo compacto de H2H para `/players` — pedido explícito (2026-09-17), calcado del
 * mismo módulo de atptour.com. A propósito NO reusa `H2HView` entero (ver
 * components/h2h/H2HView.tsx): esa es la página de detalle completa, con historial de
 * cruces, desglose por superficie/categoría/ronda y comparativa de carrera — un bloque
 * enorme para meter debajo de una rejilla de jugadores. Aquí solo va `H2HHeader` (el
 * mismo aro de reparto de victorias + panel de cada jugador que ya usa `/h2h`) más un
 * botón "Show H2H Detail" hacia la ficha completa, igual que la referencia deja el
 * desglose real para su propia página y el módulo de aquí es solo un vistazo rápido.
 *
 * Mismo arranque por defecto que `/h2h` sin argumentos (app/h2h/page.tsx): nº1 contra
 * nº2 de la semana en curso — el enfrentamiento que le interesa a todo el mundo sin
 * tener que elegir nada. `H2HPicker` (reusado tal cual) deja cambiar cualquiera de los
 * dos y su botón "Compare" ya navega a `/h2h/[p1]/[p2]` — no hace falta que este módulo
 * reaccione en vivo a una nueva elección, es la misma acción de "ver el detalle" que el
 * botón de arriba, solo que empezando por elegir en vez de aceptar el nº1/nº2 de serie.
 *
 * Vive dentro de la misma columna `1fr` junto al sidebar (app/players/page.tsx), no en
 * su propia sección a ancho completo — un primer intento la sacó fuera de la rejilla
 * para esquivar un desbordamiento real de `H2HHeader` (la cara del jugador de la
 * derecha se veía cortada, medido con Playwright: 178px de desbordamiento a 1024px de
 * viewport), pero eso solo cambiaba un bug real por otro: al vivir DESPUÉS de la
 * rejilla entera, esta sección esperaba a que el sidebar (más alto que la rejilla de
 * jugadores) terminara del todo, dejando un hueco negro enorme debajo de la rejilla
 * mientras el sidebar seguía solo a la derecha. El arreglo de verdad va en
 * `H2HHeader.tsx` (`@container`/`@3xl:` en vez de `sm:`, reacciona al ancho real
 * disponible aquí dentro en vez del viewport entero) — con eso ya cabe bien en esta
 * misma columna estrecha, sin desbordarse y sin dejar hueco.
 */
export async function PlayersH2HCompare() {
  const week = await getLatestRankingWeek();
  const [allPlayers, top] = await Promise.all([
    db.select({ id: players.id, displayName: players.displayName }).from(players).orderBy(players.displayName) as Promise<
      PlayerOption[]
    >,
    week ? getTopPlayers(week, 2) : Promise.resolve([]),
  ]);
  if (top.length < 2) return null;

  const data = await loadH2HData(top[0].playerId, top[1].playerId);
  if (!data) return null;

  return (
    <div className="mb-8">
      <H2HHeader player1={data.player1} player2={data.player2} player1Wins={data.player1Wins} player2Wins={data.player2Wins} compact />
      <div className="bg-navy-900 pb-8">
        <div className="tour-container">
          <div className="mb-6 flex justify-center">
            <Link
              href={`/h2h/${data.player1.id}/${data.player2.id}`}
              className="text-eyebrow rounded-lg bg-blue-500 px-6 py-2.5 text-xs text-white transition hover:brightness-95"
            >
              Show H2H Detail →
            </Link>
          </div>
          <H2HPicker
            players={allPlayers}
            initialPlayer1={{ id: data.player1.id, displayName: data.player1.displayName }}
            initialPlayer2={{ id: data.player2.id, displayName: data.player2.displayName }}
          />
        </div>
      </div>
    </div>
  );
}
