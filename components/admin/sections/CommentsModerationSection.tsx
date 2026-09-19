"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteCommentAsAdmin } from "@/app/admin/comments/actions";
import type { ModerationCommentRow } from "@/lib/comments";

export function CommentsModerationSection({ rows }: { rows: ModerationCommentRow[] }) {
  const [isDeleting, startDeleting] = useTransition();
  const router = useRouter();

  function handleDelete(id: number) {
    if (!window.confirm("Delete this comment? This can't be undone.")) return;
    startDeleting(async () => {
      await deleteCommentAsAdmin(id);
      router.refresh();
    });
  }

  return (
    <div>
      <h1 className="text-headline mb-6 text-2xl text-ink">Comments</h1>

      {rows.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">No comments yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-4 border-b border-rule px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-headline text-sm text-ink">{r.authorName ?? "Anonymous"}</p>
                  {r.isReply && (
                    <span className="text-eyebrow rounded-full bg-muted-label/10 px-2 py-0.5 text-[10px] text-muted-label">Reply</span>
                  )}
                  <span className="text-muted-label text-xs">{r.createdAt.toLocaleDateString("en-US")}</span>
                </div>
                <p className="mt-1 truncate text-sm text-ink">{r.body}</p>
                <Link href={`/news/${r.newsSlug}`} className="text-eyebrow text-xs text-blue-500 hover:underline">
                  {r.newsTitle}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                disabled={isDeleting}
                title="Delete comment"
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
