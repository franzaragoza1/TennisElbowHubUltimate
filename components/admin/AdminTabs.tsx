"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  Gauge,
  History,
  Image as ImageIcon,
  ListOrdered,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Radio,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Video,
} from "lucide-react";

/** Las cuentas que el resumen ya calcula (lib/adminDashboard.ts): un número junto a la
 * sección que tiene algo esperando una decisión. */
export type AdminNavCounts = Partial<Record<"players" | "news" | "match-log" | "videos" | "awards", number>>;

const ICON = "h-3.5 w-3.5 shrink-0";

const GROUPS: { label: string; items: { id: keyof AdminNavCounts | string; label: string; href: string; icon: React.ReactNode }[] }[] = [
  {
    label: "",
    items: [
      { id: "overview", label: "Overview", href: "/admin", icon: <Gauge className={ICON} aria-hidden="true" /> },
      { id: "activity", label: "Activity", href: "/admin/activity", icon: <History className={ICON} aria-hidden="true" /> },
    ],
  },
  {
    label: "Data",
    items: [
      { id: "tournaments", label: "Tournaments", href: "/admin/tournaments", icon: <Trophy className={ICON} aria-hidden="true" /> },
      { id: "rankings", label: "Rankings", href: "/admin/rankings", icon: <ListOrdered className={ICON} aria-hidden="true" /> },
      { id: "scores", label: "Scores", href: "/admin/scores", icon: <Radio className={ICON} aria-hidden="true" /> },
      { id: "match-log", label: "Match stats", href: "/admin/match-log", icon: <Activity className={ICON} aria-hidden="true" /> },
      { id: "players", label: "Players", href: "/admin/players", icon: <Users className={ICON} aria-hidden="true" /> },
      { id: "native-tournaments", label: "Own tournaments", href: "/admin/native-tournaments", icon: <Swords className={ICON} aria-hidden="true" /> },
      { id: "finals", label: "Finals", href: "/admin/finals", icon: <Award className={ICON} aria-hidden="true" /> },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "news", label: "News", href: "/admin/news", icon: <Newspaper className={ICON} aria-hidden="true" /> },
      { id: "videos", label: "Videos", href: "/admin/videos", icon: <Video className={ICON} aria-hidden="true" /> },
      { id: "thumbnails", label: "Thumbnails", href: "/admin/thumbnails", icon: <ImageIcon className={ICON} aria-hidden="true" /> },
      { id: "awards", label: "Awards", href: "/admin/awards", icon: <Sparkles className={ICON} aria-hidden="true" /> },
    ],
  },
  {
    label: "Moderation",
    items: [
      { id: "comments", label: "Comments", href: "/admin/comments", icon: <MessageCircle className={ICON} aria-hidden="true" /> },
      { id: "discussions", label: "Discussions", href: "/admin/discussions", icon: <MessagesSquare className={ICON} aria-hidden="true" /> },
    ],
  },
];

/**
 * Menú del panel de admin (/admin, rediseño 2026-10-17): antes 13 pestañas dentro de /account
 * que cargaban TODOS los datos de todas las secciones en cada visita; ahora cada sección es su
 * propia página. Mismo lenguaje visual que el menú de /account (filete lima en la activa); en
 * móvil, fila de píldoras con scroll.
 */
export function AdminTabs({ counts = {} }: { counts?: AdminNavCounts }) {
  const pathname = usePathname();
  const all = GROUPS.flatMap((g) => g.items);
  // Coincidencia más larga: /admin no debe quedar activa en /admin/players.
  const activeHref = all
    .filter((it) => (it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Admin sections" className="nav-scroll -mx-1 flex nav-scroll--column-lg gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {GROUPS.map((group, gi) => (
        <div key={group.label || "top"} className="contents">
          {group.label && (
            <span
              className={`text-eyebrow shrink-0 self-center px-3 text-[10px] text-muted-label lg:self-auto lg:pb-1 ${gi === 0 ? "" : "border-l border-rule pl-3 lg:mt-5 lg:border-l-0"}`}
            >
              {group.label}
            </span>
          )}
          {group.items.map((it) => {
            const selected = it.href === activeHref;
            const count = counts[it.id as keyof AdminNavCounts] ?? 0;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={selected ? "page" : undefined}
                className={`text-eyebrow flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 lg:border-l-2 ${
                  selected
                    ? "bg-paper text-ink shadow-sm ring-1 ring-rule lg:rounded-l-none lg:border-accent-500"
                    : "text-muted-label hover:bg-paper hover:text-ink lg:border-transparent"
                }`}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {count > 0 && (
                  <span className="tour-numeric rounded-full bg-accent-500 px-1.5 text-[10px] leading-4 font-bold text-navy-900" aria-label={`${count} waiting`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
