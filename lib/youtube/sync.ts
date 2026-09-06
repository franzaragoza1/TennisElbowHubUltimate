import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { matchVideos } from "@/db/schema";
import { fetchRecentChannelVideos } from "./client";
import { findMatchForVideoTitle } from "./matcher";

export interface SyncResult {
  scanned: number;
  autoLinked: number;
  pending: number;
  skipped: number;
  /** Ya existía en `match_videos`, pero YouTube le cambió el título desde la última
   * sincronización — se actualiza el título guardado, y si no estaba `confirmed` a
   * mano, se vuelve a intentar emparejar con el título nuevo. */
  renamed: number;
  /** Vídeos huérfanos reparados esta pasada — ver `repairOrphanedVideos` más abajo. */
  repaired: number;
}

/**
 * `lib/mana/loadTournament.ts` borra y reinserta TODOS los partidos de una edición en
 * cada recarga (los ids de `matches` no son estables entre pasadas de un torneo en
 * juego). `match_videos.matchId` tiene `onDelete: "set null"` (db/schema.ts) para no
 * reventar esa operación con una FK rota, pero eso deja el vídeo enlazado "en
 * apariencia" — `status` sigue en `auto`/`confirmed` y `matchConfidence` sigue
 * enseñando la razón de un emparejamiento que ya no existe, apuntando a la nada.
 *
 * El título de YouTube no cambió, así que el resto de `syncChannelVideos` (que solo
 * reevalúa un vídeo si su título cambió) nunca vuelve a mirarlo — sin este repaso
 * quedaría roto para siempre. Se repara con la MISMA lógica de siempre
 * (`findMatchForVideoTitle`), nunca se inventa un enlace nuevo; si ya no se puede
 * resolver a uno solo, cae a `pending` (o `unmatched`) igual que cualquier vídeo nuevo
 * ambiguo — un `confirmed` roto no se queda "confirmado" apuntando a nada, porque esa
 * confirmación ya no significa nada una vez que el partido que señalaba desapareció.
 */
async function repairOrphanedVideos(): Promise<number> {
  const orphaned = await db
    .select({ id: matchVideos.id, title: matchVideos.title })
    .from(matchVideos)
    .where(and(isNull(matchVideos.matchId), inArray(matchVideos.status, ["auto", "confirmed"])));

  let repaired = 0;
  for (const video of orphaned) {
    const lookup = await findMatchForVideoTitle(video.title);
    await db
      .update(matchVideos)
      .set({
        matchId: lookup.matchId,
        status: lookup.status,
        matchConfidence: lookup.reason,
        candidateMatchIds: lookup.candidateMatchIds,
      })
      .where(eq(matchVideos.id, video.id));
    if (lookup.matchId) repaired++;
  }
  return repaired;
}

/**
 * Escanea los vídeos recientes del canal y los reparte en tres cubos: enlazados
 * automáticamente, en cola de revisión, o descartados (título no reconocible, o
 * jugadores/partido que no se pueden determinar). Un `youtube_video_id` ya visto no
 * se vuelve a INSERTAR (sigue siendo único), pero SÍ se revisa: si el título de
 * YouTube cambió desde la última pasada (el canal renombra vídeos de vez en cuando,
 * p.ej. al corregir un nombre mal escrito), el título guardado y — salvo que un
 * admin ya lo hubiera confirmado a mano — el emparejamiento se actualizan con el
 * título nuevo. Antes esto no pasaba nunca: un vídeo ya visto se saltaba entero, así
 * que un renombre en YouTube jamás llegaba a reflejarse aquí.
 */
export async function syncChannelVideos(): Promise<SyncResult> {
  const repaired = await repairOrphanedVideos();

  const videos = await fetchRecentChannelVideos();

  const existing = await db
    .select({ id: matchVideos.id, youtubeVideoId: matchVideos.youtubeVideoId, title: matchVideos.title, status: matchVideos.status })
    .from(matchVideos);
  const existingByVideoId = new Map(existing.map((r) => [r.youtubeVideoId, r]));

  const result: SyncResult = { scanned: videos.length, autoLinked: 0, pending: 0, skipped: 0, renamed: 0, repaired };

  for (const video of videos) {
    const existingRow = existingByVideoId.get(video.videoId);

    if (existingRow) {
      if (existingRow.title === video.title) continue;

      // Un vídeo ya `confirmed` a mano nunca se reevalúa solo — un renombre no debe
      // pisar la decisión del admin, pero el título mostrado sí se pone al día.
      if (existingRow.status === "confirmed") {
        await db.update(matchVideos).set({ title: video.title }).where(eq(matchVideos.id, existingRow.id));
        result.renamed++;
        continue;
      }

      const lookup = await findMatchForVideoTitle(video.title);
      await db
        .update(matchVideos)
        .set(
          lookup.status === "unmatched"
            ? { title: video.title }
            : {
                title: video.title,
                matchId: lookup.matchId,
                status: lookup.status,
                matchConfidence: lookup.reason,
                candidateMatchIds: lookup.candidateMatchIds,
              },
        )
        .where(eq(matchVideos.id, existingRow.id));
      result.renamed++;
      continue;
    }

    const lookup = await findMatchForVideoTitle(video.title);
    if (lookup.status === "unmatched") {
      result.skipped++;
      continue;
    }

    await db.insert(matchVideos).values({
      matchId: lookup.matchId,
      youtubeVideoId: video.videoId,
      title: video.title,
      publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
      status: lookup.status,
      matchConfidence: lookup.reason,
      candidateMatchIds: lookup.candidateMatchIds,
    });

    if (lookup.status === "auto") result.autoLinked++;
    else result.pending++;
  }

  return result;
}
