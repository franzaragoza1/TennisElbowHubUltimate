import { NextResponse } from "next/server";
import { fetchLiveHtml } from "@/lib/liveTennis/fetchLive";
import { parseLivePage } from "@/lib/liveTennis/parseLivePage";
import { filterCandidates } from "@/lib/liveTennis/filterCandidates";
import { loadKnownSurfaces } from "@/lib/liveTennis/surfaces";
import { resolveAgainstOngoing, type LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

export const dynamic = "force-dynamic";

/**
 * Nunca lanza: si live-tennis.cn falla, está detrás de un challenge de Cloudflare esa
 * vez, o el HTML cambió de forma, esto responde una lista vacía en vez de tumbar la
 * sección de "Live Now" — mismo criterio de fallo silencioso que el párrafo de H2H
 * (ver docs/decisiones.md). Nunca se inventa un partido en vivo.
 */
export async function GET() {
  try {
    const html = await fetchLiveHtml();
    const raw = parseLivePage(html);
    const candidates = filterCandidates(raw, loadKnownSurfaces());
    const matches: LiveTourMatch[] = await resolveAgainstOngoing(candidates);
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
