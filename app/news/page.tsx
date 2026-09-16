import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { ReporterCtaCard } from "@/components/news/ReporterCtaCard";
import { LatestFeed } from "@/components/news/LatestFeed";
import { mergeChronologically } from "@/lib/latestFeed";
import { getPublishedNews } from "@/lib/newsQueries";
import { getFeaturedVideos } from "@/lib/youtube/featured";

export const revalidate = 300;

/**
 * "Latest", no "News" — pedido explícito del propietario (2026-09-15): con el volumen
 * de contenido real de este tour, News/Videos/Interviews como páginas separadas se
 * quedarían vacías la mayoría de las semanas. Un único carril cronológico (ver
 * components/news/LatestFeed.tsx) mezclando noticias y vídeos se siente activo con un
 * puñado de items. La URL sigue siendo /news — ya hay enlaces compartidos apuntando
 * aquí, cambiar solo el rótulo visible no los rompe.
 */
export default async function NewsIndexPage() {
  const [stories, videos] = await Promise.all([getPublishedNews(), getFeaturedVideos(6)]);
  const items = mergeChronologically(stories, videos);

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Latest"
        subtitle={items.length === 0 ? undefined : `${items.length} ${items.length === 1 ? "item" : "items"}`}
      />

      <div className="tour-container tour-container--medium py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <ReporterCtaCard />
          <LatestFeed items={items} />
        </div>
        <Sidebar hide={["news", "videos"]} />
      </div>
    </div>
  );
}
