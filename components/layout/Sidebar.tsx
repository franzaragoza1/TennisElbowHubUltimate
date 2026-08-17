import { ScoresWidget } from "@/components/layout/sidebar/ScoresWidget";
import { H2HWidget } from "@/components/layout/sidebar/H2HWidget";
import { ProfileWidget } from "@/components/layout/sidebar/ProfileWidget";
import { NewsWidget } from "@/components/layout/sidebar/NewsWidget";
import { RankingsWidget } from "@/components/layout/sidebar/RankingsWidget";
import { FeaturedVideosWidget } from "@/components/layout/sidebar/FeaturedVideosWidget";

export type SidebarWidget = "scores" | "h2h" | "profile" | "news" | "rankings" | "videos";

/**
 * Sidebar de todo el sitio — nunca enseña el widget de la sección en la que ya
 * estás (p.ej. sin widget de Scores en `/scores`): `hide` es justo esa lista.
 * Cada widget se resuelve por su cuenta y puede devolver `null` si no hay datos
 * (nada en vivo, sin noticias publicadas...) — sin huecos en blanco.
 *
 * "videos" comparte lista de ocultación con "news": `/news` ya enseña
 * `FeaturedVideos` en el cuerpo de la página (app/news/page.tsx), así que el widget
 * del sidebar se oculta ahí igual que el de noticias.
 */
export function Sidebar({ hide = [] }: { hide?: SidebarWidget[] }) {
  return (
    <aside className="mt-8 flex flex-col gap-5 lg:mt-0">
      {!hide.includes("scores") && <ScoresWidget />}
      {!hide.includes("h2h") && <H2HWidget />}
      {!hide.includes("profile") && <ProfileWidget />}
      {!hide.includes("news") && <NewsWidget />}
      {!hide.includes("videos") && <FeaturedVideosWidget />}
      {!hide.includes("rankings") && <RankingsWidget />}
    </aside>
  );
}
