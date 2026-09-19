import Link from "next/link";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopicCard } from "@/components/discussions/TopicCard";
import { SignInButton } from "@/components/account/SignInButton";
import { getDiscussionTopicsPage } from "@/lib/discussionTopics";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DiscussionsPage() {
  const [user, { rows }] = await Promise.all([getCurrentUser(), getDiscussionTopicsPage(null)]);

  return (
    <div>
      <PageMasthead eyebrow="XKT World Tour" title="Discussions" subtitle="Open a topic, talk tennis — no Discord scroll to lose it in." />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-eyebrow text-xs text-muted-label">{rows.length > 0 ? "Recent activity" : "No topics yet"}</p>
            {user ? (
              <Link href="/discussions/new" className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800">
                New topic
              </Link>
            ) : (
              <SignInButton callbackUrl="/discussions" />
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center text-sm">
              No discussions yet — be the first to open one.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((topic) => (
                <li key={topic.id}>
                  <TopicCard topic={topic} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Sidebar hide={["news", "videos"]} />
      </div>
    </div>
  );
}
