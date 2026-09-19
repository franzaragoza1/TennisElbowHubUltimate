import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/**
 * Alternador de datos ficticios para probar la UI de las predicciones de cuadro sin
 * tocar la base de datos real — pedido explícito del propietario (2026-09-18): "for me
 * only ... only on dev server for testing bracket predictions". Doble puerta, las dos
 * fijas en código (nunca configurable desde la propia web, mismo criterio que
 * `lib/adminSession.ts`):
 *   1. `NODE_ENV === "development"` — solo `next dev` en local, nunca la build de
 *      producción (Render usa `next build` + `next start`, que siempre pone "production").
 *   2. Esta cuenta de Discord en concreto, comprobada igual que `isAdmin`.
 */
const DEV_PREVIEW_DISCORD_ID = "873625384942465124";

export async function canUseDevPreview(): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") return false;

  const user = await getCurrentUser();
  if (!user) return false;

  const [account] = await db
    .select({ providerAccountId: authAccounts.providerAccountId })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, user.id), eq(authAccounts.provider, "discord")))
    .limit(1);

  return account?.providerAccountId === DEV_PREVIEW_DISCORD_ID;
}
