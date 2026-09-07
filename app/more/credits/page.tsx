import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credits — XKT World Tour",
  description: "Who built this site, and where the tournaments, matches, and rankings actually come from.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="step-reveal rounded-lg border border-rule bg-paper p-6">
      <h2 className="text-headline text-lg text-ink">{title}</h2>
      <div className="text-muted-label mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <div>
      <section className="bg-navy-900">
        <div className="tour-container tour-container--reading py-16 text-center sm:py-20">
          <p className="text-eyebrow row-reveal text-xs text-accent-500" style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>
            More · Credits
          </p>
          <h1
            className="text-headline row-reveal mt-3 text-3xl text-white sm:text-4xl"
            style={{ "--reveal-delay": "60ms" } as React.CSSProperties}
          >
            Credits
          </h1>
          <p
            className="row-reveal mx-auto mt-4 max-w-md text-sm text-white/70"
            style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
          >
            This site doesn&apos;t exist in a vacuum — here&apos;s who and what it&apos;s actually built on.
          </p>
        </div>
      </section>

      <section className="tour-container tour-container--reading flex flex-col gap-4 py-12 sm:py-16">
        <Section title="The tour itself">
          <p>
            Every tournament, match, and ranking shown here belongs to the{" "}
            <a
              href="https://www.managames.com/Forum/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Mana Games Online Tour
            </a>
            , where it&apos;s published first and run by its own organizers. This site is an unofficial,
            fan-made presentation of that same tour — the rankings you see are imported as-is and are never
            recalculated here.
          </p>
        </Section>

        <Section title="The game">
          <p>
            Every match on this tour is played in Tennis Elbow 4 — the tennis simulator this entire community
            is built around. Without it, and the people who keep the Online Tour running on top of it, there
            would be nothing to build a site for.
          </p>
        </Section>

        <Section title="This site">
          <p>
            A fan project — a different presentation of the same Online Tour data, with player pages,
            head-to-head, live scores, and a Discord bot layered on top. Not affiliated with Mana Games, and
            not an official product of Tennis Elbow 4&apos;s developer.
          </p>
          <p className="mt-3">
            <span className="text-ink font-semibold">Created by:</span> Gyrmik, Franky Franchicha
          </p>
          <p className="mt-1">
            <span className="text-ink font-semibold">Tour Admins:</span> Gyrmik, Mystery, gifu
          </p>
        </Section>

        <Section title="Built with">
          <p>Next.js, Tailwind CSS, Drizzle ORM and Postgres, ECharts, and discord.js.</p>
        </Section>

        <p className="text-muted-label mt-2 text-center text-xs">
          <Link href="/more" className="hover:text-ink">
            ← Back to More
          </Link>
        </p>
      </section>
    </div>
  );
}
