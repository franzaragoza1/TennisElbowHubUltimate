import { ScoresWidget } from "@/components/layout/sidebar/ScoresWidget";
import { H2HWidget, preloadH2HWidget } from "@/components/layout/sidebar/H2HWidget";
import { ProfileWidget, preloadProfileWidget } from "@/components/layout/sidebar/ProfileWidget";
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
/**
 * Lanza ya las consultas de los widgets que pueden ir a la BD (los de sorteo: H2H y
 * perfil; el resto sale de `unstable_cache`). Se llama en la primera línea de cada
 * página con sidebar, con la misma lista `hide` que luego recibe `<Sidebar>` — si no,
 * el sidebar no empieza a consultar nada hasta que la página termina de esperar sus
 * propios datos y devuelve el JSX (pase de rendimiento, 2026-10-11). Llamarla sobra
 * pero no rompe nada: cada widget reutiliza la misma promesa en esa petición.
 */
export function preloadSidebar(hide: SidebarWidget[] = []) {
  if (!hide.includes("h2h")) preloadH2HWidget();
  if (!hide.includes("profile")) preloadProfileWidget();
}

export function Sidebar({ hide = [] }: { hide?: SidebarWidget[] }) {
  return (
    // Solo en escritorio (pase móvil, 2026-10-11): en móvil iba DEBAJO de cada página y
    // repetía los mismos tres recuadros (scores vacío, perfil al azar, top 10) al final de
    // News, Scores, Tournaments, Players… — parecían parte de la página y la alargaban al
    // doble. Todo lo que enseña tiene su propia página en el menú.
    <aside className="hidden flex-col gap-5 lg:flex">
      {!hide.includes("scores") && <ScoresWidget />}
      {!hide.includes("h2h") && <H2HWidget />}
      {!hide.includes("profile") && <ProfileWidget />}
      {!hide.includes("news") && <NewsWidget />}
      {!hide.includes("videos") && <FeaturedVideosWidget />}
      {!hide.includes("rankings") && <RankingsWidget />}
    </aside>
  );
}
