import { getCommentsForTopic } from "@/lib/discussionTopics";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { TopicCommentForm } from "@/components/discussions/TopicCommentForm";
import { TopicCommentThread } from "@/components/discussions/TopicCommentThread";
import { SignInButton } from "@/components/account/SignInButton";

export async function TopicCommentsSection({ topicId, slug, locked }: { topicId: number; slug: string; locked: boolean }) {
  const user = await getCurrentUser();
  const [comments, userIsAdmin] = await Promise.all([getCommentsForTopic(topicId, user?.id ?? null), user ? isAdmin(user) : Promise.resolve(false)]);
  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  return (
    <div className="mt-10 border-t border-rule pt-6">
      <p className="text-eyebrow mb-4 text-xs text-muted-label">{totalCount > 0 ? `Replies (${totalCount})` : "Replies"}</p>

      {locked ? (
        <p className="mb-6 rounded-lg border border-rule bg-paper-tint px-4 py-3 text-sm text-muted-label">This topic is locked — no new replies.</p>
      ) : user ? (
        <TopicCommentForm topicId={topicId} slug={slug} />
      ) : (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper-tint px-4 py-3">
          <p className="text-sm text-muted-label">Sign in to join the conversation.</p>
          <SignInButton callbackUrl={`/discussions/${slug}`} />
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-muted-label text-sm">No replies yet — be the first.</p>
      ) : (
        <TopicCommentThread comments={comments} topicId={topicId} slug={slug} currentUserId={user?.id ?? null} isAdmin={userIsAdmin} locked={locked} />
      )}
    </div>
  );
}
