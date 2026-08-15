import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminSession";
import { logoutAdmin } from "../actions";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

/**
 * Grupo de rutas `(panel)`: todo lo que cuelga de aquí exige sesión de admin.
 * `/admin/login` vive fuera del grupo justamente para no quedar cerrado por su propia
 * puerta. Los Server Actions revalidan igualmente por su cuenta, porque un layout no
 * protege un endpoint.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="tour-container tour-container--medium py-10">
      <div className="mb-8 flex items-center justify-between border-b border-rule pb-4">
        <div className="flex items-baseline gap-4">
          <Link href="/admin" className="text-headline text-lg text-ink">
            Admin
          </Link>
          <Link href="/" className="text-eyebrow text-xs text-blue-500 hover:underline">
            View site
          </Link>
        </div>
        <form action={logoutAdmin}>
          <button
            type="submit"
            className="text-eyebrow text-xs text-muted-label hover:text-ink"
          >
            Log out
          </button>
        </form>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
