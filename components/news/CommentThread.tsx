"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { TopLevelComment, ReplyNode, CommentNode } from "@/lib/comments";
import { toggleCommentLike } from "@/app/news/[slug]/actions";
import { LikeButton } from "@/components/news/LikeButton";
import { CommentForm } from "@/components/news/CommentForm";
import { DeleteCommentButton } from "@/components/news/DeleteCommentButton";
import { LinkifiedText } from "@/components/LinkifiedText";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Único punto de render para una fila de comentario o de respuesta — la única
 * diferencia real entre las dos es el tag "@Nombre" que trae la respuesta, resuelto ya
 * en lib/comments.ts, nunca calculado aquí. */
function CommentRow({
  comment,
  newsId,
  slug,
  currentUserId,
  isAdmin,
  replyingToName,
  isReplyOpen,
  onToggleReply,
}: {
  comment: CommentNode;
  newsId: number;
  slug: string;
  currentUserId: string | null;
  isAdmin: boolean;
  replyingToName?: string | null;
  isReplyOpen: boolean;
  onToggleReply: () => void;
}) {
  const canDelete = currentUserId !== null && (currentUserId === comment.userId || isAdmin);

  return (
    <div className="flex gap-3">
      <Link href={`/members/${comment.userId}`} className="shrink-0">
        {comment.authorImage ? (
          <Image src={comment.authorImage} alt="" width={36} height={36} className="h-9 w-9 rounded-full" unoptimized />
        ) : (
          <span className="block h-9 w-9 rounded-full bg-rule" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={`/members/${comment.userId}`} className="text-headline text-sm text-ink hover:underline">
            {comment.authorName ?? "Anonymous"}
          </Link>
          <span className="text-muted-label shrink-0 text-xs">{formatDate(comment.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
          {replyingToName && <span className="mr-1 font-medium text-blue-500">@{replyingToName}</span>}
          <LinkifiedText text={comment.body} />
        </p>
        <div className="mt-2 flex items-center gap-4">
          <LikeButton initialCount={comment.likeCount} initialLiked={comment.likedByMe} toggleAction={toggleCommentLike.bind(null, comment.id, slug)} />
          {currentUserId && (
            <button type="button" onClick={onToggleReply} className="tap-scale flex items-center gap-1 text-xs text-muted-label hover:text-ink">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Reply
            </button>
          )}
          {canDelete && <DeleteCommentButton commentId={comment.id} slug={slug} />}
        </div>
        {isReplyOpen && (
          <CommentForm newsId={newsId} slug={slug} parentId={comment.id} compact autoFocus onPosted={onToggleReply} />
        )}
      </div>
    </div>
  );
}

export function CommentThread({
  comments,
  newsId,
  slug,
  currentUserId,
  isAdmin,
}: {
  comments: TopLevelComment[];
  newsId: number;
  slug: string;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);

  function toggle(id: number) {
    setOpenReplyFor((current) => (current === id ? null : id));
  }

  return (
    <ul className="space-y-6">
      {comments.map((c) => (
        <li key={c.id}>
          <CommentRow
            comment={c}
            newsId={newsId}
            slug={slug}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            isReplyOpen={openReplyFor === c.id}
            onToggleReply={() => toggle(c.id)}
          />
          {c.replies.length > 0 && (
            <ul className="mt-4 ml-12 space-y-4 border-l border-rule pl-4">
              {c.replies.map((r: ReplyNode) => (
                <li key={r.id}>
                  <CommentRow
                    comment={r}
                    newsId={newsId}
                    slug={slug}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    replyingToName={r.replyingToName}
                    isReplyOpen={openReplyFor === r.id}
                    onToggleReply={() => toggle(r.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
