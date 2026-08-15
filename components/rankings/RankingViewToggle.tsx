import Link from "next/link";

export type RankingView = "official" | "race" | "nextgen";

/** Enlaces reales (no estado local), como `SeasonTabs`: cada vista es compartible y
 * navegable con el historial del navegador. Conserva `week`/`top` si ya estaban en
 * la URL, para no perder el resto de filtros al cambiar de vista. */
export function RankingViewToggle({
  current,
  extraParams,
}: {
  current: RankingView;
  extraParams: Record<string, string | undefined>;
}) {
  const buildHref = (view: RankingView) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
    params.set("view", view);
    return `/rankings?${params.toString()}`;
  };

  const tabs: { view: RankingView; label: string }[] = [
    { view: "official", label: "Official Rankings" },
    { view: "race", label: "Race to Finals" },
    { view: "nextgen", label: "Next Gen Race" },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.view}
          href={buildHref(tab.view)}
          aria-current={tab.view === current ? "page" : undefined}
          className={`text-eyebrow rounded-full px-4 py-2 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
            tab.view === current
              ? "bg-accent-500 text-navy-900"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
