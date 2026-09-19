"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Lock, Unlock } from "lucide-react";
import { deleteTopic, deleteTopicCommentAsAdmin, lockTopic, unlockTopic } from "@/app/discussions/actions";
import type { ModerationTopicRow, ModerationTopicCommentRow } from "@/lib/discussionTopics";

export function DiscussionsModerationSection({ topics, comments }: { topics: ModerationTopicRow[]; comments: ModerationTopicCommentRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDeleteTopic(id: number) {
    if (!window.confirm("Delete this topic and all its replies? This can't be undone.")) return;
    startTransition(async () => {
      await deleteTopic(id);
      router.refresh();
    });
  }

  function handleToggleLock(id: number, slug: string, locked: boolean) {
    startTransition(async () => {
      if (locked) await unlockTopic(id, slug);
      else await lockTopic(id, slug);
      router.refresh();
    });
  }

  function handleDeleteComment(id: number) {
    if (!window.confirm("Delete this reply? This can't be undone.")) return;
    startTransition(async () => {
      await deleteTopicCommentAsAdmin(id);
      router.refresh();
    });
  }

  return (
    <div>
      <h1 className="text-headline mb-6 text-2xl text-ink">Discussions</h1>

      <p className="text-eyebrow mb-3 text-xs text-muted-label">Topics</p>
      {topics.length === 0 ? (
        <p className="text-muted-label mb-8 rounded-lg border border-rule bg-paper px-4 py-6 text-center text-sm">No topics yet.</p>
      ) : (
        <div className="mb-8 overflow-hidden rounded-lg border border-rule bg-paper">
          {topics.map((t) => {
            const locked = t.status === "locked";
            return (
              <div key={t.id} className="flex items-start gap-4 border-b border-rule px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/discussions/${t.slug}`} className="text-headline text-sm text-ink hover:underline">
                      {t.title}
                    </Link>
                    {locked && <span className="text-eyebrow rounded-full bg-muted-label/10 px-2 py-0.5 text-[10px] text-muted-label">Locked</span>}
                  </div>
                  <p className="text-muted-label text-xs">
                    {t.authorName ?? "Anonymous"} · {t.createdAt.toLocaleDateString("en-US")} · {t.commentCount} replies
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleLock(t.id, t.slug, locked)}
                    disabled={isPending}
                    title={locked ? "Unlock topic" : "Lock topic"}
                    className="tap-scale flex items-center gap-1 text-xs text-muted-label hover:text-ink disabled:opacity-50"
                  >
                    {locked ? <Unlock className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    {locked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTopic(t.id)}
                    disabled={isPending}
                    title="Delete topic"
                    className="tap-scale flex items-center gap-1 text-xs text-down hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-eyebrow mb-3 text-xs text-muted-label">Recent replies</p>
      {comments.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">No replies yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {comments.map((r) => (
            <div key={r.id} className="flex items-start gap-4 border-b border-rule px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-headline text-sm text-ink">{r.authorName ?? "Anonymous"}</p>
                  {r.isReply && <span className="text-eyebrow rounded-full bg-muted-label/10 px-2 py-0.5 text-[10px] text-muted-label">Reply</span>}
                  <span className="text-muted-label text-xs">{r.createdAt.toLocaleDateString("en-US")}</span>
                </div>
                <p className="mt-1 truncate text-sm text-ink">{r.body}</p>
                <Link href={`/discussions/${r.topicSlug}`} className="text-eyebrow text-xs text-blue-500 hover:underline">
                  {r.topicTitle}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteComment(r.id)}
                disabled={isPending}
                title="Delete reply"
                className="tap-scale flex shrink-0 items-center gap-1 text-xs text-down hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
