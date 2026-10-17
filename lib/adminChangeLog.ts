import { getCurrentUser } from "@/lib/auth";
import { logChanges } from "@/lib/changeLog";

// Aparte de lib/changeLog.ts a propósito: este lee la sesión (next-auth), y el scraper
// (scripts/autoScrape.ts, fuera de Next) también registra cambios y no debe cargarla.

/** Una acción hecha desde el panel de admin, con el nombre de quien la hizo. */
export async function logAdminChange(kind: string, summary: string, extra?: { editionId?: number | null; details?: unknown }): Promise<void> {
  let actorName: string | null = null;
  try {
    actorName = (await getCurrentUser())?.name ?? null;
  } catch {
    // sin sesión legible: se registra igual, sin nombre
  }
  await logChanges([{ source: "admin", kind, summary, actorName, editionId: extra?.editionId, details: extra?.details }]);
}

/** Los campos de un formulario de admin, para el detalle del registro (sin textos largos:
 * el cuerpo de una noticia no hace falta guardarlo aquí). */
export function formDetails(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    out[k] = v.length > 120 ? `${v.slice(0, 120)}…` : v;
  }
  return out;
}
