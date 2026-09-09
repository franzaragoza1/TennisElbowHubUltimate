import Link from "next/link";
import type { Metadata } from "next";
import { CourtBackdrop } from "@/components/layout/CourtBackdrop";

export const metadata: Metadata = {
  title: "FAQ — XKT World Tour",
  description: "How the ranking works, how to claim your profile, and what the Discord bot does.",
};

interface FaqEntry {
  question: string;
  answer: React.ReactNode;
}

const FAQS: FaqEntry[] = [
  {
    question: "Is this the official Online Tour site?",
    answer: (
      <>
        No — this is a community hub of useful, automated tools built around the{" "}
        <a href="https://www.managames.com/Forum/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          Mana Games Online Tour
        </a>
        , not the official site. The tour itself, and every result on it, is still run entirely on the Mana
        Games forum. What this site adds on top is player pages, head-to-head, live scores, stats, MatchLog
        imports, and a Discord bot — none of which the forum offers on its own.
      </>
    ),
  },
  {
    question: "Where does the ranking come from?",
    answer:
      "Directly from Mana Games' own weekly ranking snapshot — it's imported as-is and shown here, never recalculated. If you think a position looks wrong, that's a question for the tour's own rules, not something this site can override.",
  },
  {
    question: "How do I claim my profile?",
    answer: (
      <>
        Sign in with Discord, then search for your in-game name from your account page and request the link.
        An admin reviews and approves it — it&apos;s a manual check, not instant, since it&apos;s what
        protects everyone else&apos;s profile from being claimed by the wrong person. See the{" "}
        <Link href="/welcome" className="text-blue-500 hover:underline">
          welcome guide
        </Link>{" "}
        for the full walkthrough.
      </>
    ),
  },
  {
    question: "Why does it want me to upload a MatchLog file?",
    answer:
      "Tennis Elbow 4 writes a detailed stat sheet (aces, serve percentage, winners...) for every match you play, saved locally on your own PC. Uploading it lets the site attach those real per-match stats to your profile — it's entirely optional, and any match that doesn't match a real tour result is safely skipped, never guessed.",
  },
  {
    question: "What does the Discord bot do?",
    answer:
      "It posts new matchups and results as they come in, sends deadline reminders, and can start a short AI-driven post-match interview with either player. It's a separate always-on process from the website, built and run by the same team.",
  },
  {
    question: "I found a bug or something looks wrong — who do I tell?",
    answer: "Reach out in the tour's Discord server. This is a community-run project, and real reports are how it gets better.",
  },
];

export default function FaqPage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-navy-900">
        <CourtBackdrop />
        <div className="tour-container tour-container--reading relative py-16 text-center sm:py-20">
          <p className="text-eyebrow row-reveal text-xs text-accent-500" style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>
            More · FAQ
          </p>
          <h1
            className="text-headline row-reveal mt-3 text-3xl text-white sm:text-4xl"
            style={{ "--reveal-delay": "60ms" } as React.CSSProperties}
          >
            Frequently asked questions
          </h1>
        </div>
      </section>

      <section className="tour-container tour-container--reading flex flex-col gap-3 py-12 sm:py-16">
        {FAQS.map((faq, i) => (
          <details
            key={faq.question}
            className="step-reveal group rounded-lg border border-rule bg-paper open:bg-paper-tint"
            style={{ "--reveal-delay": `${i * 40}ms` } as React.CSSProperties}
          >
            <summary className="text-headline flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-ink marker:content-none">
              {faq.question}
              <span className="text-muted-label shrink-0 text-lg transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="text-muted-label px-5 pb-4 text-sm leading-relaxed">{faq.answer}</p>
          </details>
        ))}

        <p className="text-muted-label mt-4 text-center text-xs">
          <Link href="/more" className="hover:text-ink">
            ← Back to More
          </Link>
        </p>
      </section>
    </div>
  );
}
