import type { FeaturedVideo } from "@/lib/youtube/featured";

/** Thumbnail estable de YouTube por convención de URL — no hace falta llamar a la API
 * solo para pintar una miniatura. */
function thumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function FeaturedVideos({ videos }: { videos: FeaturedVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="text-eyebrow mb-3 text-xs text-muted-label">Featured videos</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {videos.map((v) => (
          <a
            key={v.id}
            href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-lg border border-rule bg-paper transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <div className="relative aspect-video overflow-hidden bg-paper-tint">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura remota de YouTube, no un asset local */}
              <img
                src={thumbnailUrl(v.youtubeVideoId)}
                alt=""
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-navy-900/20 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-down text-white shadow-lg">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="p-3">
              <p className="text-headline truncate text-sm text-ink group-hover:text-blue-500">
                {v.caption ?? v.title}
              </p>
              {v.caption && <p className="text-muted-label mt-0.5 truncate text-xs">{v.title}</p>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
