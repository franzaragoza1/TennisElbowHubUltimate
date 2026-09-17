import Image from "next/image";
import { getCommentsForNews } from "@/lib/comments";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { CommentForm } from "@/components/news/CommentForm";
import { DeleteCommentButton } from "@/components/news/DeleteCommentButton";
import { SignInButton } from "@/components/account/SignInButton";
import { LinkifiedText } from "@/components/LinkifiedText";

export async function CommentsSection({ newsId, slug }: { newsId: number; slug: string }) {
  const [comments, user] = await Promise.all([getCommentsForNews(newsId), getCurrentUser()]);
  const userIsAdmin = user ? await isAdmin(user) : false;

  return (
    <div className="mt-10 border-t border-rule pt-6">
      <p className="text-eyebrow mb-4 text-xs text-muted-label">
        {comments.length > 0 ? `Comments (${comments.length})` : "Comments"}
      </p>

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
        <ul className="space-y-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {c.authorImage ? (
                <Image src={c.authorImage} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" unoptimized />
              ) : (
                <span className="h-9 w-9 shrink-0 rounded-full bg-rule" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-headline text-sm text-ink">{c.authorName ?? "Anonymous"}</p>
                  <span className="text-muted-label shrink-0 text-xs">
                    {c.createdAt.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  <LinkifiedText text={c.body} />
                </p>
                {user && (user.id === c.userId || userIsAdmin) && <DeleteCommentButton commentId={c.id} slug={slug} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
