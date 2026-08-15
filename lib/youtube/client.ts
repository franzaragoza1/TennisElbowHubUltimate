export interface YouTubeVideoSummary {
  videoId: string;
  title: string;
  publishedAt: string | null;
}

/** @TennisElbowOnlineTour — https://www.youtube.com/@TennisElbowOnlineTour */
const CHANNEL_HANDLE = "TennisElbowOnlineTour";

export async function fetchRecentChannelVideos(maxResults = 25): Promise<YouTubeVideoSummary[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      `YOUTUBE_API_KEY is not configured. Add it to .env to enable syncing @${CHANNEL_HANDLE}.`
    );
  }

  try {
    // PASSO 1: Ottenere l'ID della playlist "Uploads" dall'Handle del canale
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=@${CHANNEL_HANDLE}&key=${apiKey}`;
    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`Canale @${CHANNEL_HANDLE} non trovato o API key non valida.`);
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // PASSO 2: Scaricare gli ultimi video da quella playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();

    if (!playlistData.items) {
      return [];
    }

    // PASSO 3: Mappare i risultati nell'interfaccia YouTubeVideoSummary richiesta
    return playlistData.items.map((item: any) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt || null,
    }));

  } catch (error) {
    console.error("Errore durante il fetch dei video da YouTube:", error);
    throw error; // Rilancia l'errore per farlo gestire a syncChannelVideos come previsto da Claude
  }
}