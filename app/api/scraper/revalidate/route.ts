import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Llamado por `scripts/autoScrape.ts` (cron local/servidor casero, ver Dockerfile)
 * después de cada pasada, para que el sitio desplegado recoja los datos que el script
 * acaba de escribir directamente en la base de datos. `revalidatePath` solo existe
 * dentro de un proceso de Next.js corriendo, así que un script suelto no puede
 * llamarlo directamente — de ahí este endpoint.
 *
 * Secreto propio (`SCRAPER_SECRET`), no `CRON_SECRET`: son fronteras de confianza
 * distintas — `CRON_SECRET` autentica el GitHub Action de `youtube-sync-cron.yml`,
 * este lo tiene la máquina que corre el scraper (nunca la misma). Poder rotar uno sin
 * tocar el otro importa si algún día esa máquina cambia.
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
  // tocar cualquiera de estas páginas. El panel de admin vive dentro de /account
  // ahora (components/account/AdminSection.tsx), no en sus propias rutas.
  revalidatePath("/");
  revalidatePath("/tournaments");
  revalidatePath("/scores");
  revalidatePath("/account");
  for (const id of editionIds) revalidatePath(`/tournaments/${id}`);

  // Bug real encontrado en producción (2026-09-18): una importación de ranking (botón
  // "Refresh Rankings" del admin -> petición 'ranking' en `scrapeRequests`, procesada
  // por esta misma pasada) nunca invalidaba nada aquí — `/rankings` y el widget del
  // sidebar (`RankingsWidget.tsx`) leen `ranking_snapshots` a través de `unstable_cache`
  // con un TTL propio (1h / 10min) y sin ninguna otra vía de invalidación, así que un
  // ranking recién importado podía tardar hasta una hora en aparecer — o quedarse
  // enseñando el resultado vacío de ANTES de la primera importación hasta que ese TTL
  // por fin venciera. Se llama siempre, no solo cuando la petición procesada era de tipo
  // 'ranking' — barato y sigue el mismo patrón que `revalidatePath("/")` de arriba
  // (incondicional en cada pasada, nunca condicionado a qué cambió de verdad).
  //
  // `revalidateTag`, no `updateTag`: este endpoint es un Route Handler, no una Server
  // Action, y `updateTag` solo funciona dentro de una — de ahí el segundo argumento
  // `{ expire: 0 }` (expiración inmediata, sin ventana de "sigue sirviendo lo viejo
  // mientras revalida en segundo plano").
  revalidateTag("rankings", { expire: 0 });

  return NextResponse.json({ revalidated: true, editionCount: editionIds.length });
}
