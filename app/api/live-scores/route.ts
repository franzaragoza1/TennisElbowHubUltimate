import { NextResponse } from "next/server";
import { fetchLiveHtml } from "@/lib/liveTennis/fetchLive";
import { parseLivePage } from "@/lib/liveTennis/parseLivePage";
import { filterCandidates } from "@/lib/liveTennis/filterCandidates";
import { loadKnownSurfaces } from "@/lib/liveTennis/surfaces";
import { resolveAgainstOngoing, type LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

// 20s de caché compartida — bug de coste real reportado: esta ruta la sondea
// lib/liveTennis/useLiveScores.ts cada 30s desde CADA pestaña abierta en CASI
// cualquier página del sitio (components/layout/sidebar/ScoresWidget.tsx vive en el
// sidebar global), y estaba en `force-dynamic`: cada una de esas peticiones repetía el
// fetch externo a live-tennis.cn Y la consulta a la base entera, sin compartir nada
// entre visitantes — con varias pestañas abiertas a la vez eso es N peticiones
// externas + N consultas por cada ventana de 30s, no 1. Con `revalidate` en vez de
// `force-dynamic`, todas las peticiones que caen dentro de la misma ventana de 20s
// comparten UNA sola ejecución real, sin importar cuánta gente esté mirando a la vez
// — la sensación de "en vivo" no cambia (sigue actualizándose cada 20-30s), el coste sí.
export const revalidate = 20;

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
