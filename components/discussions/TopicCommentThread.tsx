"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { TopLevelComment, ReplyNode, CommentNode } from "@/lib/discussionTopics";
import { toggleTopicCommentLike } from "@/app/discussions/actions";
import { LikeButton } from "@/components/news/LikeButton";
import { TopicCommentForm } from "@/components/discussions/TopicCommentForm";
import { TopicDeleteCommentButton } from "@/components/discussions/TopicDeleteCommentButton";
import { LinkifiedText } from "@/components/LinkifiedText";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Copia de components/news/CommentThread.tsx repuntada a los temas de discusión — ver
 * ese fichero para el porqué del diseño (un único punto de render para fila normal y
 * respuesta, "@Nombre" ya resuelto en lib/discussionTopics.ts). */
function CommentRow({
  comment,
  topicId,
  slug,
  currentUserId,
  isAdmin,
  locked,
  replyingToName,
  isReplyOpen,
  onToggleReply,
}: {
  comment: CommentNode;
  topicId: number;
  slug: string;
  currentUserId: string | null;
  isAdmin: boolean;
  locked: boolean;
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
          <LikeButton initialCount={comment.likeCount} initialLiked={comment.likedByMe} toggleAction={toggleTopicCommentLike.bind(null, comment.id, slug)} />
          {currentUserId && !locked && (
            <button type="button" onClick={onToggleReply} className="tap-scale flex items-center gap-1 text-xs text-muted-label hover:text-ink">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Reply
            </button>
          )}
          {canDelete && <TopicDeleteCommentButton commentId={comment.id} slug={slug} />}
        </div>
        {isReplyOpen && (
          <TopicCommentForm topicId={topicId} slug={slug} parentId={comment.id} compact autoFocus onPosted={onToggleReply} />
        )}
      </div>
    </div>
  );
}

export function TopicCommentThread({
  comments,
  topicId,
  slug,
  currentUserId,
  isAdmin,
  locked,
}: {
  comments: TopLevelComment[];
  topicId: number;
  slug: string;
  currentUserId: string | null;
  isAdmin: boolean;
  locked: boolean;
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
            topicId={topicId}
            slug={slug}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            locked={locked}
            isReplyOpen={openReplyFor === c.id}
            onToggleReply={() => toggle(c.id)}
          />
          {c.replies.length > 0 && (
            <ul className="mt-4 ml-12 space-y-4 border-l border-rule pl-4">
              {c.replies.map((r: ReplyNode) => (
                <li key={r.id}>
                  <CommentRow
                    comment={r}
                    topicId={topicId}
                    slug={slug}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    locked={locked}
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
