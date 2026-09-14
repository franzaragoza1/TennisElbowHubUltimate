import Link from "next/link";

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
 */
export function SiteFooter() {
  return (
    <footer className="bg-navy-900">
      <div className="tour-container flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-headline text-white">XKT World Tour</p>
          <p className="text-xs text-white/50">Tennis Elbow 4 Online Tour</p>
        </div>

        <div className="max-w-md text-xs leading-relaxed text-white/60">
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
          <p className="mt-3">
            Tournament names shown here (Madrid, Indian Wells, the Tour Finals, and so on) mirror
            real-world venues the Tennis Elbow 4 game itself is set in — this site is not
            affiliated with, endorsed by, or sponsored by the ATP, the WTA, or the ITF.
          </p>
          <p className="mt-3">
            <Link href="/rankings" className="hover:text-white">
              Rankings
            </Link>
            {" · "}
            <Link href="/players" className="hover:text-white">
              Players
            </Link>
            {" · "}
            <Link href="/tournaments" className="hover:text-white">
              Tournaments
            </Link>
            {" · "}
            <Link href="/h2h" className="hover:text-white">
              H2H
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
