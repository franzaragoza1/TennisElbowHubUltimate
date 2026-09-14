import { and, eq, isNotNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db/client";
import { editions, pendingSlots } from "@/db/schema";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { tournamentCircuit } from "@/lib/tournamentCircuit";
import { loadH2HData } from "@/lib/h2hPage";

/** Este widget sale en el sidebar de casi todas las páginas del sitio (nunca está en
 * ninguna lista `hide`) — pase de rendimiento, 2026-09-14: antes hacía la consulta de
 * candidatos MÁS `loadH2HData` (~6 consultas propias, ver lib/h2hPage.ts) sin caché
 * alguna, en cada visita a cualquier página, confirmado como el coste real detrás de
 * un tiempo de respuesta de ~800ms+ en páginas por lo demás ya cacheadas (/stats,
 * /tournaments) — quitar el sidebar entero de una de esas páginas lo bajaba a ~15ms.
 * La elección al azar (pedida explícita: "uno al azar... no un cruce fijo") se queda
 * viva, SIN cachear — lo caro es el trabajo por pareja elegida, eso sí se cachea, por
 * pareja: si la misma pareja vuelve a salir sorteada (probable, el conjunto de cruces
 * pendientes no cambia cada segundo), reutiliza el resultado en vez de repetirlo. */
const getPendingCircuitCandidates = unstable_cache(
  async () => {
    const rows = await db
      .select({ player1Id: pendingSlots.player1Id, player2Id: pendingSlots.player2Id, category: editions.category })
      .from(pendingSlots)
      .innerJoin(editions, eq(editions.id, pendingSlots.editionId))
      .where(and(isNotNull(pendingSlots.player1Id), isNotNull(pendingSlots.player2Id)));
    return rows.filter((r) => tournamentCircuit(r.category) === "tour");
  },
  ["h2h-widget-candidates"],
  { revalidate: 300 },
);

const getH2HWidgetData = unstable_cache(
  async (player1Id: number, player2Id: number) => loadH2HData(player1Id, player2Id),
  ["h2h-widget-pair-data"],
  { revalidate: 3600 },
);

/**
 * Cara a cara de un cruce YA EMPAREJADO pero todavía sin jugar (`pending_slots`, ver
 * db/schema.ts — un hueco con los dos lados resueltos pero sin marcador todavía), de
 * un torneo del circuito principal (`tournamentCircuit(category) === "tour"`: Grand
 * Slam/Masters 1000/500/250/Exhibition — nunca Challenger ni Future, pedido
 * explícito). Uno al azar de todos los que cumplan, elegido en cada carga — no un
 * cruce fijo. Si ahora mismo no hay ninguno (nada emparejado en el circuito
 * principal), el widget no sale, en vez de caer a un emparejamiento que no sea el
 * pedido.
 */
export async function H2HWidget() {
  const candidates = await getPendingCircuitCandidates();
  if (candidates.length === 0) return null;

  // Server Component: elección al azar pedida explícitamente (ver comentario de arriba),
  // se recalcula en cada request del servidor.
  // eslint-disable-next-line react-hooks/purity
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const data = await getH2HWidgetData(picked.player1Id!, picked.player2Id!);
  if (!data) return null;

  return (
    <SidebarPanel title="HEAD2HEAD" href={`/h2h/${data.player1.id}/${data.player2.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1.5">
          <PlayerAvatar displayName={data.player1.displayName} country={data.player1.country} avatarUrl={data.player1.avatarUrl} />
          <p className="text-ink w-20 truncate text-center text-xs">{data.player1.displayName}</p>
        </div>
        <div className="tour-numeric text-headline shrink-0 text-lg text-ink">
          {data.player1Wins}
          <span className="text-muted-label mx-1 text-xs font-normal">vs</span>
          {data.player2Wins}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <PlayerAvatar displayName={data.player2.displayName} country={data.player2.country} avatarUrl={data.player2.avatarUrl} />
          <p className="text-ink w-20 truncate text-center text-xs">{data.player2.displayName}</p>
        </div>
      </div>
    </SidebarPanel>
  );
}
