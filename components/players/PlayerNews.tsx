import Link from "next/link";
import type { NewsCardData } from "@/lib/newsQueries";
import { surfaceColor } from "@/lib/surfaceColors";

/** Noticias en las que se ha etiquetado a este jugador. Si no hay ninguna, la sección
 * entera desaparece en vez de dejar un hueco vacío. */
export function PlayerNews({ stories }: { stories: NewsCardData[] }) {
  if (stories.length === 0) return null;

  return (
    <>
      <h2 className="text-headline mt-10 mb-4 text-lg text-navy-900">In the news</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stories.map((s) => (
          <Link
            key={s.id}
            href={`/news/${s.slug}`}
            className="group flex gap-3 overflow-hidden rounded-lg border border-rule bg-paper transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <div
              className="w-1.5 shrink-0"
              style={{
                backgroundColor: s.surface ? surfaceColor(s.surface) : "var(--navy-700)",
              }}
            />
            <div className="min-w-0 flex-1 py-3 pr-3">
              <p className="text-eyebrow text-[10px] text-muted-label">
                {s.category}
                {s.publishedAt
                  ? ` · ${s.publishedAt.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : ""}
              </p>
              <p className="text-headline mt-0.5 line-clamp-2 text-navy-900 group-hover:text-blue-500">
                {s.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
