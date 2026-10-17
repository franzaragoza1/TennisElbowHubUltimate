import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminSession";
import { getAdminOverview } from "@/lib/adminDashboard";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
// Datos de admin siempre frescos: nada de esto se cachea.
export const dynamic = "force-dynamic";

/**
 * Panel de admin en su propia dirección (rediseño 2026-10-17, ver docs/decisiones.md): antes
 * vivía como 13 pestañas dentro de /account y cada visita cargaba los datos de todas. Cada
 * Server Action sigue comprobando `requireAdmin()` por su cuenta; esto solo decide quién ve
 * las páginas.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/account");
  const overview = await getAdminOverview();
  const a = overview.attention;

  return (
    <div className="tour-container py-8 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6">
          <p className="text-eyebrow hidden px-3 text-[10px] text-accent-500 lg:block">Admin</p>
          <AdminTabs
            counts={{
              players: a.playerClaims,
              news: a.newsDrafts + a.reporterRequests,
              "match-log": a.nameSuggestions,
              videos: a.pendingVideos,
              awards: a.awardSubmissions,
            }}
          />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
