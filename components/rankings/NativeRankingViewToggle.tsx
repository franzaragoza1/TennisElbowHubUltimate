import Link from "next/link";

export type NativeRankingView = "official" | "live" | "nextgen";

/** Mismo componente visual que RankingViewToggle, pero para el ranking nativo — las
 * tres vistas no son las mismas conceptos que las de Mana (aquí es literalmente
 * Official/Live/Next Gen, no Official/Race/Next Gen Race), así que es un componente
 * aparte en vez de forzar las mismas etiquetas sobre el otro. */
export function NativeRankingViewToggle({ current }: { current: NativeRankingView }) {
  const tabs: { view: NativeRankingView; label: string }[] = [
    { view: "official", label: "Official Ranking" },
    { view: "live", label: "Live Ranking" },
    { view: "nextgen", label: "Next Gen Ranking" },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.view}
          href={`/rankings?tour=native&view=${tab.view}`}
          aria-current={tab.view === current ? "page" : undefined}
          className={`text-eyebrow rounded-full px-4 py-2 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
            tab.view === current
              ? "bg-accent-500 text-navy-900"
              : "bg-rule/60 text-muted-label hover:bg-rule hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
