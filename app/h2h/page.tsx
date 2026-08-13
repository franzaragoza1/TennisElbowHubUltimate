import { db } from "@/db/client";
import { players } from "@/db/schema";
import { H2HView } from "@/components/h2h/H2HView";
import { H2HPicker, type PlayerOption } from "@/components/h2h/H2HPicker";
import { loadH2HData } from "@/lib/h2hPage";
import { getLatestRankingWeek, getTopPlayers } from "@/lib/tourQueries";

export const revalidate = 3600;

/**
 * `/h2h` sin argumentos no enseña un formulario en blanco: arranca con el cara a cara
 * del nº1 contra el nº2 de la semana en curso, que es el enfrentamiento que a todo el
 * mundo le interesa por defecto.
 */
export default async function H2HDefaultPage() {
  const week = await getLatestRankingWeek();
  const [allPlayers, top] = await Promise.all([
    db
      .select({ id: players.id, displayName: players.displayName })
      .from(players)
      .orderBy(players.displayName) as Promise<PlayerOption[]>,
    week ? getTopPlayers(week, 2) : Promise.resolve([]),
  ]);

  const data = top.length === 2 ? await loadH2HData(top[0].playerId, top[1].playerId) : null;

  return (
    <div>
      <div className="bg-navy-900 pt-8">
        <div className="tour-container">
          <H2HPicker players={allPlayers} />
        </div>
      </div>

      {data ? (
        <H2HView data={data} />
      ) : (
        <div className="tour-container py-16">
          <p className="text-muted-label">Not enough ranking data to build a head-to-head yet.</p>
        </div>
      )}
    </div>
  );
}
