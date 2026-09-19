import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio, MessageCircle, Trophy } from "lucide-react";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getFollowingFeed, type FollowingActivityItem } from "@/lib/followingFeed";

export const dynamic = "force-dynamic";

function ActivityRow({ item }: { item: FollowingActivityItem }) {
  if (item.kind === "match_live") {
    return (
      <Link href={item.linkHref} className="hover-lift block rounded-lg border border-up bg-up/5 p-4 transition-colors hover:border-up">
        <div className="flex items-center gap-2 text-xs text-up">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-up" aria-hidden="true" />
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Live now · {item.tournamentName} · {item.roundLabel}
        </div>
        <p className="text-headline mt-1 text-sm text-ink">
          {item.player1Name} vs {item.player2Name}
        </p>
      </Link>
    );
  }

  if (item.kind === "match_finished") {
    const winnerName = item.winnerId === item.player1Id ? item.player1Name : item.player2Name;
    const loserName = item.winnerId === item.player1Id ? item.player2Name : item.player1Name;
    return (
      <Link href={`/tournaments/${item.editionId}`} className="hover-lift block rounded-lg border border-rule bg-paper p-4 transition-colors hover:border-blue-500">
        <div className="text-muted-label flex items-center gap-2 text-xs">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {item.eventName} · {item.round}
        </div>
        <p className="mt-1 text-sm text-ink">
          <span className="text-headline">{winnerName}</span> beat {loserName}
          {item.scoreRaw && <span className="tour-numeric text-muted-label ml-2">{item.scoreRaw}</span>}
        </p>
      </Link>
    );
  }

  return (
    <Link href={`/discussions/${item.topicSlug}`} className="hover-lift block rounded-lg border border-rule bg-paper p-4 transition-colors hover:border-blue-500">
      <div className="text-muted-label flex items-center gap-2 text-xs">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {item.authorName ?? "Anonymous"} replied in {item.topicTitle}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-ink">{item.body}</p>
    </Link>
  );
}

export default async function FollowingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account");

  const items = await getFollowingFeed(user.id);

  return (
    <div>
      <PageMasthead eyebrow="XKT World Tour" title="Following" subtitle="Everything happening with the players, tournaments, and topics you follow." />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {items.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center text-sm">
              Nothing yet — follow a player, a tournament, or a discussion topic to see their activity here.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, i) => (
                <li key={`${item.kind}-${i}`}>
                  <ActivityRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
