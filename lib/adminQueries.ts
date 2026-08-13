import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, events, players } from "@/db/schema";
import type { EditionOption, TagOption } from "@/components/admin/NewsForm";

/** Opciones de los desplegables del formulario de noticias. */
export async function getNewsFormOptions(): Promise<{
  players: TagOption[];
  editions: EditionOption[];
}> {
  const [playerRows, editionRows] = await Promise.all([
    db
      .select({ id: players.id, displayName: players.displayName })
      .from(players)
      .orderBy(players.displayName),
    db
      .select({
        id: editions.id,
        year: editions.year,
        isoWeek: editions.isoWeek,
        eventName: events.displayName,
      })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .orderBy(desc(editions.year), desc(editions.isoWeek))
      .limit(300),
  ]);

  return {
    players: playerRows,
    editions: editionRows.map((e) => ({
      id: e.id,
      label: `${e.eventName} — ${e.year}${e.isoWeek ? ` W${e.isoWeek}` : ""}`,
    })),
  };
}
