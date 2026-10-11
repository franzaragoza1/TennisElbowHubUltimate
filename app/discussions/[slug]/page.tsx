import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { LikeButton } from "@/components/news/LikeButton";
import { TopicCommentsSection } from "@/components/discussions/TopicCommentsSection";
import { LinkifiedText } from "@/components/LinkifiedText";
import { getTopicBySlug } from "@/lib/discussionTopics";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { db } from "@/db/client";
import { topicLikes } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { toggleTopicLike, lockTopic, unlockTopic, deleteTopic } from "@/app/discussions/actions";
import { toggleFollow } from "@/app/follows/actions";
import { isFollowing } from "@/lib/follows";
import { FollowButton } from "@/components/follows/FollowButton";

export const dynamic = "force-dynamic";

async function getTopicLikeInfo(topicId: number, userId: string | null) {
  const [[{ value }], likedRow] = await Promise.all([
    db.select({ value: count() }).from(topicLikes).where(eq(topicLikes.topicId, topicId)),
    userId ? db.select({ id: topicLikes.id }).from(topicLikes).where(and(eq(topicLikes.topicId, topicId), eq(topicLikes.userId, userId))) : Promise.resolve([]),
  ]);
  return { count: value, likedByMe: likedRow.length > 0 };
}

export default async function DiscussionTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  preloadSidebar(["news", "videos"]);
  const { slug } = await params;
  const [topic, user] = await Promise.all([getTopicBySlug(slug), getCurrentUser()]);
  if (!topic) notFound();

  const [likeInfo, userIsAdmin, following] = await Promise.all([
    getTopicLikeInfo(topic.id, user?.id ?? null),
    user ? isAdmin(user) : Promise.resolve(false),
    isFollowing(user?.id ?? null, "topic", topic.id),
  ]);
  const locked = topic.status === "locked";

  const posted = topic.createdAt.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <PageMasthead eyebrow={locked ? "Discussion · Locked" : "Discussion"} title={topic.title} subtitle={posted} />

      <div className="tour-container tour-container--medium py-10 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <article className="min-w-0 max-w-[640px]">
          <div className="mb-4 flex items-center gap-3">
            <Link href={`/members/${topic.authorUserId}`} className="shrink-0">
              {topic.authorImage ? (
                <Image src={topic.authorImage} alt="" width={36} height={36} className="h-9 w-9 rounded-full" unoptimized />
              ) : (
                <span className="block h-9 w-9 rounded-full bg-rule" />
              )}
            </Link>
            <div className="min-w-0">
              <Link href={`/members/${topic.authorUserId}`} className="text-headline block text-sm text-ink hover:underline">
                {topic.authorName ?? "Anonymous"}
              </Link>
              <p className="text-muted-label text-xs">{posted}</p>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            <LinkifiedText text={topic.body} />
          </p>

          <div className="mt-4 flex items-center gap-4">
            <LikeButton initialCount={likeInfo.count} initialLiked={likeInfo.likedByMe} toggleAction={toggleTopicLike.bind(null, topic.id, topic.slug)} />
            <FollowButton
              targetType="topic"
              targetId={topic.id}
              initialFollowing={following}
              toggleAction={toggleFollow.bind(null, "topic", topic.id, `/discussions/${topic.slug}`)}
            />
            {userIsAdmin && (
              <div className="flex items-center gap-3 text-xs">
                {locked ? (
                  <form action={unlockTopic.bind(null, topic.id, topic.slug)}>
                    <button type="submit" className="text-blue-500 hover:underline">
                      Unlock
                    </button>
                  </form>
                ) : (
                  <form action={lockTopic.bind(null, topic.id, topic.slug)}>
                    <button type="submit" className="text-muted-label hover:underline">
                      Lock
                    </button>
                  </form>
                )}
                <form action={deleteTopic.bind(null, topic.id)}>
                  <button type="submit" className="text-down hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            )}
          </div>

          <TopicCommentsSection topicId={topic.id} slug={topic.slug} locked={locked} />

          <Link href="/discussions" className="text-eyebrow mt-10 inline-block text-xs text-blue-500 hover:underline">
            ← All discussions
          </Link>
        </article>
        <Sidebar hide={["news", "videos"]} />
      </div>
    </div>
  );
}
