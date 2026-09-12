import { NextResponse } from "next/server";
import { fetchLiveHtml } from "@/lib/liveTennis/fetchLive";
import { parseLivePage } from "@/lib/liveTennis/parseLivePage";
import { filterCandidates } from "@/lib/liveTennis/filterCandidates";
import { loadKnownSurfaces } from "@/lib/liveTennis/surfaces";
import { resolveAgainstOngoing, type LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

// 60s de caché compartida (subido desde 20s, ver docs/decisiones.md) — esta ruta es
// la que más CPU activa real gasta de todo el sitio (confirmado en Vercel
// Observability, no una sospecha): a diferencia de la mayoría de rutas, que solo
// esperan a la base de datos, aquí SIEMPRE se parsea en crudo el HTML entero de
// live-tennis.cn en cada ejecución real — trabajo de CPU de verdad, no E/S. El
// sondeo del cliente sigue siendo cada 30s (lib/liveTennis/useLiveScores.ts) desde
// CASI cualquier página del sitio (el sidebar global incluido), así que antes una
// ventana de 20s (más corta que el propio sondeo) apenas evitaba nada; con 60s, la
// mayoría de sondeos caen ya dentro de una ventana compartida en vez de disparar
// trabajo nuevo — la sensación de "en vivo" sigue siendo de segundos, no de minutos,
// el coste real baja bastante más.
export const revalidate = 60;

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
