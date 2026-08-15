import { db } from "@/db/client";
import { matchVideos } from "@/db/schema";
import { fetchRecentChannelVideos } from "./client";
import { findMatchForVideoTitle } from "./matcher";

export interface SyncResult {
  scanned: number;
  autoLinked: number;
  pending: number;
  skipped: number;
}

/**
 * Escanea los vídeos recientes del canal y los reparte en tres cubos: enlazados
 * automáticamente, en cola de revisión, o descartados (título no reconocible, o
 * jugadores/partido que no se pueden determinar). Idempotente: `youtube_video_id` es
 * único en `match_videos`, así que un vídeo ya visto en una sincronización anterior
 * no se vuelve a procesar.
 */
export async function syncChannelVideos(): Promise<SyncResult> {
  const videos = await fetchRecentChannelVideos();

  const existing = await db.select({ youtubeVideoId: matchVideos.youtubeVideoId }).from(matchVideos);
  const seen = new Set(existing.map((r) => r.youtubeVideoId));

  const result: SyncResult = { scanned: videos.length, autoLinked: 0, pending: 0, skipped: 0 };

  for (const video of videos) {
    if (seen.has(video.videoId)) continue;

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
