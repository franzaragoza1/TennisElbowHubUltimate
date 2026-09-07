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
  { label: "Videos", href: "/admin/videos" },
  { label: "Scores", href: "/admin/scores" },
];

export function AdminTabs() {
  const pathname = usePathname();
  // Coincidencia más larga, no "el primero que haga match" — /admin/players y
  // /admin/players/[id] comparten prefijo, así que en la ficha de un jugador un
  // startsWith suelto no debe dejar de marcar "Players" como activa.
  const activeHref = TABS
    .filter((tab) => (tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="nav-scroll flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible sm:pb-0">
      {TABS.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-eyebrow shrink-0 rounded-md px-3 py-2 text-left text-xs whitespace-nowrap transition-colors duration-200 ${
              isActive ? "bg-navy-900 text-white" : "text-muted-label hover:bg-paper-tint hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
