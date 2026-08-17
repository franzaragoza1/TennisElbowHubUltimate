import { eq } from "drizzle-orm";
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
  const videos = await fetchRecentChannelVideos();

  const existing = await db
    .select({ id: matchVideos.id, youtubeVideoId: matchVideos.youtubeVideoId, title: matchVideos.title, status: matchVideos.status })
    .from(matchVideos);
  const existingByVideoId = new Map(existing.map((r) => [r.youtubeVideoId, r]));

  const result: SyncResult = { scanned: videos.length, autoLinked: 0, pending: 0, skipped: 0, renamed: 0 };

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
