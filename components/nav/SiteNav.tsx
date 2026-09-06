"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { BrandBar } from "./BrandBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SearchBar } from "./SearchBar";

const SECTIONS: { label: string; href: string | null }[] = [
  { label: "Scores", href: "/scores" },
  { label: "News", href: "/news" },
  { label: "H2H", href: "/h2h" },
  { label: "Stats", href: "/stats" },
  { label: "Rankings", href: "/rankings" },
  { label: "Players", href: "/players" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Finals", href: "/finals" },
  { label: "More", href: null },
];

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  // El sistema de admin es independiente del de usuarios (Discord) — sigue
  // consultándose aparte, ver lib/adminSession.ts.
  const [isAdmin, setIsAdmin] = useState(false);
  // "The website will ask every user to upload match logs every now and then" —
  // ver lib/matchLog/uploadReminder.ts. Solo tiene sentido consultar esto con sesión
  // iniciada, así que se sondea cada vez que cambia `session`, no `pathname`.
  const [matchLogOverdue, setMatchLogOverdue] = useState(false);
  // Vive aquí, no dentro de SearchBar: la píldora de búsqueda crece en `absolute`
  // sobre estos mismos botones (tema, Admin Mode, sesión) en vez de empujarlos —
  // sin apagarlos mientras está abierta, se los tapaba en vez de crecer sobre el
  // hueco vacío que dejan.
  const [searchExpanded, setSearchExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/admin-session")
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

  useEffect(() => {
    // La ruta ya devuelve overdue:false sin sesión, así que no hace falta ramificar
    // aquí — igual que la de isAdmin arriba.
    fetch("/api/account/match-log/reminder")
      .then((res) => res.json())
      .then((data) => setMatchLogOverdue(Boolean(data?.overdue)))
      .catch(() => setMatchLogOverdue(false));
  }, [session]);

  return (
    <header className="w-full">
      {/* Misma banda hero en todas las páginas (pedido explícito) — antes la home iba a
       * tamaño hero y el resto a compacto, y el salto de altura entre páginas era
       * incómodo al navegar. */}
      <BrandBar size="hero" />
      <div className="bg-navy-900 w-full">
      <div className="tour-container flex h-14 items-center justify-between gap-4">
        <nav className="nav-scroll flex flex-1 items-center gap-5 overflow-x-auto md:gap-6">
          {SECTIONS.map((section) => {
            const isActive = section.href !== null && pathname.startsWith(section.href);
            if (!section.href) {
              return (
                <span
                  key={section.label}
                  className="text-eyebrow flex shrink-0 cursor-default items-center border-b-2 border-transparent py-2 text-xs text-white/40"
                >
                  {section.label}
                </span>
              );
            }
            return (
              <Link
                key={section.label}
                href={section.href}
                className={`text-eyebrow flex shrink-0 items-center py-2 text-xs transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500 ${
                  isActive
                    ? "border-b-2 border-accent-500 text-white"
                    : "border-b-2 border-transparent text-white/70 hover:text-white"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <div
            className={`flex items-center gap-3 transition-opacity duration-200 ${
              searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <ThemeToggle />
            {matchLogOverdue && (
              <Link
                href="/account"
                className="text-eyebrow flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
                Upload MatchLog
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-eyebrow flex items-center gap-1.5 rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-500 hover:bg-accent-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />
                Admin Mode
              </Link>
            )}
          </div>

          <SearchBar expanded={searchExpanded} onExpandedChange={setSearchExpanded} />

          <div
            className={`flex items-center gap-3 transition-opacity duration-200 ${
              searchExpanded ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            {session?.user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/account"
                  className="flex items-center gap-2 text-eyebrow text-xs text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] shrink-0 rounded-full"
                      unoptimized
                    />
                  )}
                  {session.user.name}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-eyebrow text-xs text-white/40 hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("discord")}
                className="text-eyebrow rounded-full bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}
