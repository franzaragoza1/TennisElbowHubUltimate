import Link from "next/link";
import { PARTNER_LINKS } from "@/lib/partnerLinks";

/**
 * Atribución a la fuente, que CLAUDE.md §5 exige de forma visible: los datos son del
 * Online Tour de Mana Games, aquí solo se presentan.
 *
 * Va en texto plano, no con `logo.png`: ese PNG es un wordmark navy y sobre el propio
 * fondo navy del pie se volvería invisible (el mismo motivo por el que `BrandBar` va
 * sobre cian). Sin la bola de la versión anterior — se retiró del sitio entero.
 *
 * Segundo párrafo (2026-09-14): descargo de no afiliación con ATP/WTA/ITF. Decisión
 * consciente de mantener los escudos de torneo extraídos del propio juego (lib/
 * tournamentLogos.ts) pese al riesgo de marca que representan nombres/venues reales —
 * este texto es la mitigación elegida en vez de retirarlos.
 *
 * Pase visual (2026-10-11): columnas (marca, páginas del tour, comunidad) y los dos
 * párrafos de atribución en una franja inferior — antes la mitad izquierda del pie
 * quedaba vacía y los enlaces eran una línea suelta bajo el texto legal. El texto de
 * atribución no cambia.
 */
export function SiteFooter() {
  return (
    <footer className="bg-navy-900 text-white">
      <div className="tour-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="text-headline text-lg text-white">XKT Tour</p>
            <p className="mt-1 text-sm text-white/60">Tennis Elbow 4 Online Tour</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Rankings, draws, results and stories from the Tennis Elbow 4 online tour, updated automatically.
            </p>
          </div>

          <nav aria-label="Tour">
            <p className="text-eyebrow text-[11px] text-accent-500">The tour</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {TOUR_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} prefetch={false} className="text-white/75 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Community">
            <p className="text-eyebrow text-[11px] text-accent-500">Community</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/news" prefetch={false} className="text-white/75 transition-colors hover:text-white">
                  Latest
                </Link>
              </li>
              <li>
                <Link href="/discussions" prefetch={false} className="text-white/75 transition-colors hover:text-white">
                  Discussions
                </Link>
              </li>
              {PARTNER_LINKS.map((l) => (
                <li key={l.id}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-white/75 transition-colors hover:text-white">
                    {l.label} <span aria-hidden="true" className="text-white/40">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 grid gap-4 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/55 lg:grid-cols-2 lg:gap-10">
          <p>
            A community hub of useful, automated tools for the{" "}
            <a
              href="https://www.managames.com/Forum/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-500 hover:underline"
            >
              Mana Games Online Tour
            </a>
            , not its official site. All tournament, match and ranking data belongs to the tour
            itself, where it is published first — the rankings you see here are imported as-is and
            never recalculated.
          </p>
          <p>
            Tournament names shown here (Madrid, Indian Wells, the Tour Finals, and so on) mirror
            real-world venues the Tennis Elbow 4 game itself is set in — this site is not
            affiliated with, endorsed by, or sponsored by the ATP, the WTA, or the ITF.
          </p>
        </div>
      </div>
    </footer>
  );
}

const TOUR_LINKS = [
  { label: "Scores", href: "/scores" },
  { label: "Rankings", href: "/rankings" },
  { label: "Players", href: "/players" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Stats", href: "/stats" },
  { label: "Head to head", href: "/h2h" },
];
