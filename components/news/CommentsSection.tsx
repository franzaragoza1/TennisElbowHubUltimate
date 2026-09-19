import { getCommentsForNews } from "@/lib/comments";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { CommentForm } from "@/components/news/CommentForm";
import { CommentThread } from "@/components/news/CommentThread";
import { SignInButton } from "@/components/account/SignInButton";

export async function CommentsSection({ newsId, slug }: { newsId: number; slug: string }) {
  const user = await getCurrentUser();
  const [comments, userIsAdmin] = await Promise.all([getCommentsForNews(newsId, user?.id ?? null), user ? isAdmin(user) : Promise.resolve(false)]);
  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  return (
    <div className="mt-10 border-t border-rule pt-6">
      <p className="text-eyebrow mb-4 text-xs text-muted-label">{totalCount > 0 ? `Comments (${totalCount})` : "Comments"}</p>

      {user ? (
        <CommentForm newsId={newsId} slug={slug} />
      ) : (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper-tint px-4 py-3">
          <p className="text-sm text-muted-label">Sign in to join the conversation.</p>
          <SignInButton callbackUrl={`/news/${slug}`} />
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-muted-label text-sm">No comments yet — be the first.</p>
      ) : (
        <CommentThread comments={comments} newsId={newsId} slug={slug} currentUserId={user?.id ?? null} isAdmin={userIsAdmin} />
      )}
    </div>
  );
}
