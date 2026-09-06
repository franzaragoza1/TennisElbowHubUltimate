import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { scrapeRequests } from "@/db/schema";
import type { ScrapeRequestKind } from "@/lib/scrapeQueue";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

const STATUS_CLASS: Record<string, string> = {
  queued: "text-muted-label",
  running: "text-blue-500",
  done: "text-up",
  failed: "text-down",
};

/**
 * Últimas ~10 peticiones encoladas para el servidor casero (ver lib/scrapeQueue.ts) de
 * un tipo concreto — mismo patrón de lista que
 * app/admin/(panel)/players/claims/page.tsx, sin acciones (nada que aprobar/rechazar
 * aquí, solo un vistazo a si el servidor casero ya las recogió). No se pinta nada si
 * todavía nunca se ha usado la cola para este tipo — no añade ruido a una página que
 * hasta ahora seguía funcionando en directo sin ella.
 */
export async function ScrapeRequestsPanel({ kind }: { kind: ScrapeRequestKind }) {
  const rows = await db
    .select()
    .from(scrapeRequests)
    .where(eq(scrapeRequests.kind, kind))
    .orderBy(desc(scrapeRequests.requestedAt))
    .limit(10);

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-paper">
      <p className="text-eyebrow border-b border-rule px-4 py-2 text-[10px] text-muted-label">
        Queued for the home server
      </p>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 text-xs last:border-0">
          <div className="min-w-0">
            <span className="text-ink">{row.input ? `Trn=${row.input}` : "Refresh"}</span>
            <span className="text-muted-label"> · requested {row.requestedAt.toLocaleString("en-US")}</span>
            {row.error && <p className="text-down mt-0.5 truncate">{row.error}</p>}
          </div>
          <span className={`text-eyebrow shrink-0 text-[10px] ${STATUS_CLASS[row.status] ?? "text-muted-label"}`}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        </div>
      ))}
    </div>
  );
}
