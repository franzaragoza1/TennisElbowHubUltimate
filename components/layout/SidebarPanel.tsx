import Link from "next/link";

/**
 * Caja compartida de cada widget del sidebar (Scores/H2H/Profile/News/Rankings) —
 * mismo patrón de cabecera que `SectionHeading` en `app/page.tsx` pero a la escala
 * más pequeña que pide un panel de ~320px, para no repetir cinco veces una cabecera
 * hecha a mano.
 */
export function SidebarPanel({
  title,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  href: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hover-lift animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-lg border border-rule bg-paper shadow-sm duration-500">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <h2 className="text-eyebrow text-xs text-blue-500">{title}</h2>
        {/* Sin prefetch (pase de rendimiento, 2026-09-14) — este enlace sale en el
         * sidebar de casi todas las páginas del sitio (Scores/H2H/Profile/News/
         * Rankings), siempre al mismo destino por visita; next/link lo precargaría en
         * cuanto entrara en el viewport en CADA visita, aunque casi nadie lo pulse. */}
        <Link href={href} prefetch={false} className="group text-eyebrow shrink-0 text-[11px] text-muted-label hover:text-blue-500">
          {linkLabel}{" "}
          <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
