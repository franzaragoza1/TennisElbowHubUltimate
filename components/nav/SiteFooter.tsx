import Image from "next/image";
import Link from "next/link";

/**
 * Atribución a la fuente, que CLAUDE.md §5 exige de forma visible: los datos son del
 * Online Tour de Mana Games, aquí solo se presentan.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy-900">
      <div className="tour-container flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/assets/ball.png" alt="" width={40} height={40} className="shrink-0" />
          <div>
            <p className="text-headline text-white">XKT World Tour</p>
            <p className="text-xs text-white/50">Tennis Elbow 4 Online Tour</p>
          </div>
        </div>

        <div className="max-w-md text-xs leading-relaxed text-white/60">
          <p>
            Unofficial site. All tournament, match and ranking data belongs to the{" "}
            <a
              href="https://www.managames.com/Forum/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-500 hover:underline"
            >
              Mana Games Online Tour
            </a>
            , where it is published first. What you see here is a different presentation of
            it, with derived stats — the rankings themselves are imported as-is and are
            never recalculated.
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
