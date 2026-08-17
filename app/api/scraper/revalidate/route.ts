import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Llamado por `scripts/autoScrape.ts` (cron local, no Vercel Cron — por eso no hay
 * entrada en `vercel.json`) después de cada pasada, para que el sitio desplegado
 * recoja los datos que el script acaba de escribir directamente en la base de datos.
 * `revalidatePath` solo existe dentro de un proceso de Next.js corriendo, así que un
 * script suelto no puede llamarlo directamente — de ahí este endpoint.
 *
 * Secreto propio (`SCRAPER_SECRET`), no `CRON_SECRET`: son fronteras de confianza
 * distintas — `CRON_SECRET` autentica la propia infraestructura de Vercel, este lo
 * tiene una máquina de fuera de Vercel. Poder rotar uno sin tocar el otro importa si
 * algún día esa máquina cambia.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SCRAPER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SCRAPER_SECRET is not configured" }, { status: 501 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const editionIds: number[] = Array.isArray(body?.editionIds)
    ? body.editionIds.filter((n: unknown) => typeof n === "number")
    : [];

  // Mismo conjunto que ya revalidan `addOrRefreshTournament`/`refreshScoresNow` en
  // app/admin/{tournaments,scores}/actions.ts — un torneo o un resultado nuevo puede
  // tocar cualquiera de estas páginas.
  revalidatePath("/");
  revalidatePath("/tournaments");
  revalidatePath("/scores");
  revalidatePath("/admin/tournaments");
  revalidatePath("/admin/scores");
  for (const id of editionIds) revalidatePath(`/tournaments/${id}`);

  return NextResponse.json({ revalidated: true, editionCount: editionIds.length });
}
