"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "News", href: "/admin" },
  { label: "Tournaments", href: "/admin/tournaments" },
  { label: "Finals", href: "/admin/finals" },
  { label: "Videos", href: "/admin/videos" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 border-b border-rule">
      {TABS.map((tab) => {
        const isActive = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-eyebrow border-b-2 px-3 pb-2 text-xs ${
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
