import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { getFeaturedVideos } from "@/lib/youtube/featured";

const MAX_SHOWN = 3;

/** Miniatura estable de YouTube por convención de URL — no hace falta llamar a la
 * API solo para pintar una miniatura (mismo criterio que components/news/FeaturedVideos.tsx). */
function thumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function FeaturedVideosWidget() {
  const videos = await getFeaturedVideos(MAX_SHOWN);
  if (videos.length === 0) return null;

  return (
    <SidebarPanel title="VIDEOS" href="/news" linkLabel="View all">
      <div className="space-y-3">
        {videos.map((v) => (
          <a
            key={v.id}
            href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5"
          >
            <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-paper-tint">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura remota de YouTube, no un asset local */}
              <img src={thumbnailUrl(v.youtubeVideoId)} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-navy-900/20">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-down text-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </span>
            <span className="text-ink line-clamp-2 text-xs group-hover:text-blue-500">{v.caption ?? v.title}</span>
          </a>
        ))}
      </div>
    </SidebarPanel>
  );
}
