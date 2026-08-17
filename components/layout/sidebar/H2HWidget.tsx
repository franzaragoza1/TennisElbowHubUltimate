import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, pendingSlots } from "@/db/schema";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { tournamentCircuit } from "@/lib/tournamentCircuit";
import { loadH2HData } from "@/lib/h2hPage";

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
  const rows = await db
    .select({ player1Id: pendingSlots.player1Id, player2Id: pendingSlots.player2Id, category: editions.category })
    .from(pendingSlots)
    .innerJoin(editions, eq(editions.id, pendingSlots.editionId))
    .where(and(isNotNull(pendingSlots.player1Id), isNotNull(pendingSlots.player2Id)));

  const candidates = rows.filter((r) => tournamentCircuit(r.category) === "tour");
  if (candidates.length === 0) return null;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const data = await loadH2HData(picked.player1Id!, picked.player2Id!);
  if (!data) return null;

  return (
    <SidebarPanel title="HEAD2HEAD" href={`/h2h/${data.player1.id}/${data.player2.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1.5">
          <PlayerAvatar displayName={data.player1.displayName} country={data.player1.country} character={data.player1.character} />
          <p className="text-ink w-20 truncate text-center text-xs">{data.player1.displayName}</p>
        </div>
        <div className="tour-numeric text-headline shrink-0 text-lg text-ink">
          {data.player1Wins}
          <span className="text-muted-label mx-1 text-xs font-normal">vs</span>
          {data.player2Wins}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <PlayerAvatar displayName={data.player2.displayName} country={data.player2.country} character={data.player2.character} />
          <p className="text-ink w-20 truncate text-center text-xs">{data.player2.displayName}</p>
        </div>
      </div>
    </SidebarPanel>
  );
}
