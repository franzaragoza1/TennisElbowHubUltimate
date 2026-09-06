"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "News", href: "/admin" },
  { label: "Tournaments", href: "/admin/tournaments" },
  { label: "Rankings", href: "/admin/rankings" },
  { label: "Match Stats", href: "/admin/match-log" },
  { label: "Finals", href: "/admin/finals" },
  { label: "Players", href: "/admin/players" },
  { label: "Player Claims", href: "/admin/players/claims" },
  { label: "Videos", href: "/admin/videos" },
  { label: "Scores", href: "/admin/scores" },
];

export function AdminTabs() {
  const pathname = usePathname();
  // Coincidencia más larga, no "el primero que haga match" — /admin/players y
  // /admin/players/claims comparten prefijo, así que en /admin/players/claims un
  // startsWith suelto marcaría los dos como activos a la vez.
  const activeHref = TABS
    .filter((tab) => (tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="mb-6 flex gap-1 border-b border-rule">
      {TABS.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-eyebrow border-b-2 px-3 pb-2 text-xs transition-colors duration-200 ${
              isActive ? "border-blue-500 text-ink" : "border-transparent text-muted-label hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
