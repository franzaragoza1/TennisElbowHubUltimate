import { db } from "@/db/client";
import { changeLog } from "@/db/schema";

export interface ChangeEntry {
  source: "scraper" | "admin" | "bot";
  kind: string;
  summary: string;
  editionId?: number | null;
  actorName?: string | null;
  details?: unknown;
}

/**
 * Escribe en el registro de cambios (`change_log`, ver db/schema.ts). Nunca lanza: un fallo
 * al registrar no debe tumbar la carga o la acción que sí se hizo — solo se avisa en consola.
 */
export async function logChanges(entries: ChangeEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await db.insert(changeLog).values(
      entries.map((e) => ({
        source: e.source,
        kind: e.kind,
        summary: e.summary,
        editionId: e.editionId ?? null,
        actorName: e.actorName ?? null,
        details: e.details ?? null,
      })),
    );
  } catch (err) {
    console.error("✗ No se pudo escribir en change_log:", err);
  }
}
