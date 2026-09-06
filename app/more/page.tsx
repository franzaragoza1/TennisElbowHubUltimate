import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "More — XKT World Tour",
  description: "Credits, FAQ, and everything else that doesn't fit in the main tabs.",
};

interface MoreCard {
  href: string;
  title: string;
  description: string;
}

const CARDS: MoreCard[] = [
  {
    href: "/more/faq",
    title: "FAQ",
    description: "How the ranking works, how to claim your profile, and what the Discord bot does.",
  },
  {
    href: "/more/credits",
    title: "Credits",
    description: "Who built this, and where the tournaments, matches, and rankings actually come from.",
  },
];

export default function MorePage() {
  return (
    <div>
      <section className="bg-navy-900">
        <div className="tour-container tour-container--reading py-16 text-center sm:py-20">
          <p className="text-eyebrow row-reveal text-xs text-accent-500" style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>
            More
          </p>
          <h1
            className="text-headline row-reveal mt-3 text-3xl text-white sm:text-4xl"
            style={{ "--reveal-delay": "60ms" } as React.CSSProperties}
          >
            Everything else about the tour
          </h1>
        </div>
      </section>

      <section className="tour-container tour-container--reading py-12 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card, i) => (
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
