import Link from "next/link";

export type Tour = "mana" | "native";

/** Selector de más alto nivel que RankingViewToggle — a cuál de los dos sistemas de
 * ranking pertenece la vista de abajo. Mismo look, una jerarquía por encima:
 * "unificado en la página, separado en el código" (pedido explícito) — cambia qué
 * consulta alimenta la tabla, nunca mezcla datos de los dos. */
export function TourSelector({ current }: { current: Tour }) {
  const tabs: { tour: Tour; label: string }[] = [
    { tour: "mana", label: "Mana Games Archive" },
    { tour: "native", label: "TE4 Tour" },
  ];

  return (
    <div className="mb-3 flex gap-2 border-b border-rule pb-3">
      {tabs.map((tab) => (
        <Link
          key={tab.tour}
          href={tab.tour === "native" ? "/rankings?tour=native" : "/rankings"}
          aria-current={tab.tour === current ? "page" : undefined}
          className={`text-eyebrow rounded-full px-4 py-2 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
            tab.tour === current ? "bg-navy-900 text-white" : "bg-paper-tint text-muted-label hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
