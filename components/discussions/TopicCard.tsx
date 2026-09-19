import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Heart, Lock } from "lucide-react";
import type { TopicFeedRow } from "@/lib/discussionTopics";

const EXCERPT_LENGTH = 160;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function TopicCard({ topic }: { topic: TopicFeedRow }) {
  const excerpt = topic.body.length > EXCERPT_LENGTH ? `${topic.body.slice(0, EXCERPT_LENGTH)}…` : topic.body;

  return (
    <Link
      href={`/discussions/${topic.slug}`}
      className="hover-lift block rounded-lg border border-rule bg-paper p-4 transition-colors hover:border-blue-500"
    >
      <div className="flex items-start gap-3">
        {topic.authorImage ? (
          <Image src={topic.authorImage} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" unoptimized />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-full bg-rule" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-headline truncate text-base text-ink">{topic.title}</h2>
            {topic.status === "locked" && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-label" aria-hidden="true" />}
          </div>
          <p className="text-muted-label mt-1 line-clamp-2 text-sm">{excerpt}</p>
          <div className="text-muted-label mt-2 flex items-center gap-4 text-xs">
            <span>{topic.authorName ?? "Anonymous"}</span>
            <span>{formatDate(topic.lastActivityAt)}</span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {topic.commentCount}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              {topic.likeCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
