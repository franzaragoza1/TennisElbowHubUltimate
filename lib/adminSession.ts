import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { authAccounts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/**
 * Puerta del panel de administración — pedido explícito del propietario tras hablar
 * de reforzar la seguridad del proyecto según crece: antes era UNA contraseña
 * compartida sin ninguna identidad real detrás (cualquiera con la contraseña era
 * indistinguible de cualquier otro admin, y filtrarla una vez daba acceso total para
 * siempre hasta rotarla). Ahora es la misma cuenta de Discord real que ya usa el
 * resto del sitio (lib/auth.ts) — sin contraseña propia que gestionar ni rotar.
 *
 * Quién es admin lo decide una lista fija de IDs reales de Discord
 * (`ADMIN_DISCORD_USER_IDS`, coma-separados), nunca una tabla editable desde la
 * propia web — mismo criterio que los roles de Discord del bot
 * (lib/discordBot/roleConfig.ts): cambiar quién tiene acceso es un cambio de entorno
 * + redeploy, nunca una acción que un admin ya vinculado pudiera hacer por su cuenta
 * dentro del panel.
 */
function adminDiscordIds(): Set<string> {
  const raw = process.env.ADMIN_DISCORD_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function isAdmin(): Promise<boolean> {
  const ids = adminDiscordIds();
  if (ids.size === 0) return false;

  const user = await getCurrentUser();
  if (!user) return false;

  const [account] = await db
    .select({ providerAccountId: authAccounts.providerAccountId })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, user.id), eq(authAccounts.provider, "discord")))
    .limit(1);

  return account !== undefined && ids.has(account.providerAccountId);
}

/** Cada Server Action revalida su propia puerta: un Server Action es un endpoint
 * público. Redirige a /account (nunca hubo — y ya no hay ni ruta — /admin/login
 * propia): el panel entero vive dentro de /account como una sección más, ver
 * components/account/AdminSection.tsx. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/account");
}
