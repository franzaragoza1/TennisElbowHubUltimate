import Link from "next/link";

/**
 * Enlace real, como `RankingViewToggle` — no estado de cliente, así que el toggle es
 * compartible/navegable con el historial. Solo tiene sentido interactivo en Oficial:
 * Race y Next Gen son SIEMPRE en vivo (pedido explícito, no expiran puntos), así que
 * aquí se pintan como una insignia fija, no un botón.
 */
export function LiveRankingToggle({
  view,
  isLive,
  extraParams,
}: {
  view: "official" | "race" | "nextgen";
  isLive: boolean;
  extraParams: Record<string, string | undefined>;
}) {
  if (view !== "official") {
    return (
      <span className="text-eyebrow inline-flex items-center gap-1.5 rounded-full bg-down/10 px-3 py-1.5 text-xs text-down">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-down opacity-75" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-down" />
        </span>
        Live
      </span>
    );
  }

  const buildHref = (next: boolean) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
    params.set("view", view);
    if (next) params.set("live", "1");
    return `/rankings?${params.toString()}`;
  };

  return (
    <Link
      href={buildHref(!isLive)}
      aria-pressed={isLive}
      className={`tap-scale text-eyebrow inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
        isLive ? "bg-down text-white" : "border border-white/15 bg-black font-semibold text-white shadow-sm"
      }`}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />}
        <span className={`relative h-1.5 w-1.5 rounded-full ${isLive ? "bg-white" : "bg-muted-label"}`} />
      </span>
      Live
    </Link>
  );
}
