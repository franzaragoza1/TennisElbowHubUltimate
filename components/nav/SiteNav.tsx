"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/dashboard/actions";
import { BrandBar } from "./BrandBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const SECTIONS: { label: string; href: string | null }[] = [
  { label: "News", href: "/news" },
  { label: "Scores", href: null },
  { label: "H2H", href: "/h2h" },
  { label: "Stats", href: null },
  { label: "Rankings", href: "/rankings" },
  { label: "Players", href: "/players" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Finals", href: "/finals" },
  { label: "More", href: null },
];

export interface NavSession {
  playerId: number;
  displayName: string;
}

export function SiteNav() {
  const pathname = usePathname();
  // Se consulta en cliente (en vez de leer la cookie en el layout raíz) para no
  // forzar toda la web a renderizado dinámico — /rankings y /players/[id] siguen
  // pudiendo generarse en estático.
  const [session, setSession] = useState<NavSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then(setSession)
      .catch(() => setSession(null));
    fetch("/api/admin-session")
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

  return (
    <header className="w-full">
      {/* Misma banda hero en todas las páginas (pedido explícito) — antes la home iba a
       * tamaño hero y el resto a compacto, y el salto de altura entre páginas era
       * incómodo al navegar. */}
      <BrandBar size="hero" />
      <div className="bg-navy-900 w-full">
      <div className="tour-container flex h-14 items-center justify-between gap-4">
        <nav className="flex flex-1 items-center gap-5 overflow-x-auto md:gap-6">
          {SECTIONS.map((section) => {
            const isActive = section.href !== null && pathname.startsWith(section.href);
            if (!section.href) {
              return (
                <span
                  key={section.label}
                  className="text-eyebrow shrink-0 cursor-default border-b-2 border-transparent pb-1 text-xs text-white/40"
                >
                  {section.label}
                </span>
              );
            }
            return (
              <Link
                key={section.label}
                href={section.href}
                className={`text-eyebrow shrink-0 pb-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500 ${
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
          <ThemeToggle />
          {isAdmin && (
            <Link
              href="/admin"
              className="text-eyebrow flex items-center gap-1.5 rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-500 hover:bg-accent-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />
              Admin Mode
            </Link>
          )}
          <button
            type="button"
            aria-label="Search"
            className="rounded-full p-2 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {session ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-eyebrow text-xs text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                {session.displayName}
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-eyebrow text-xs text-white/40 hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-eyebrow rounded-full bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
