import Link from "next/link";
import type { Metadata } from "next";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { MORE_SECTIONS } from "@/lib/moreSections";

export const metadata: Metadata = {
  title: "More — XKT Tour",
  description: "Credits, FAQ, and everything else that doesn't fit in the main tabs.",
};

export default function MorePage() {
  return (
    <div>
      {/* Misma cabecera que el resto de secciones (pase móvil, 2026-10-11): era la única página
       * con el título centrado y su propia banda, y en móvil parecía otra web. */}
      <PageMasthead eyebrow="XKT Tour" title="More" subtitle="Everything else about the tour." />

      <section className="tour-container py-8 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MORE_SECTIONS.map((card, i) => (
            <Link
              key={card.href}
              href={card.href}
              className="hover-lift row-reveal flex flex-col gap-2 rounded-lg border border-rule bg-paper p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              style={{ "--reveal-delay": `${i * 60}ms` } as React.CSSProperties}
            >
              <h2 className="text-headline text-lg text-ink">{card.title} →</h2>
              <p className="text-muted-label text-sm leading-relaxed">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
