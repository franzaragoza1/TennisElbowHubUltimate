import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { matchVideos } from "@/db/schema";
import { SyncButton } from "@/components/admin/videos/SyncButton";
import { PendingVideoRow } from "@/components/admin/videos/PendingVideoRow";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [pending, recent] = await Promise.all([
    db.select().from(matchVideos).where(eq(matchVideos.status, "pending")).orderBy(desc(matchVideos.createdAt)),
    db
      .select()
      .from(matchVideos)
      .where(inArray(matchVideos.status, ["auto", "confirmed"]))
      .orderBy(desc(matchVideos.createdAt))
      .limit(20),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-headline text-2xl text-ink">VOD matching</h1>
          <p className="text-muted-label text-xs">
            Scans youtube.com/@TennisElbowOnlineTour for recent uploads and links them to match records.
          </p>
        </div>
        <SyncButton />
      </div>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Needs review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            Nothing waiting on a manual confirmation.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((v) => (
              <PendingVideoRow
                key={v.id}
                video={{ id: v.id, title: v.title, matchConfidence: v.matchConfidence, candidateMatchIds: v.candidateMatchIds }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-headline mb-3 text-lg text-ink">Recently linked</h2>
        {recent.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            Nothing linked yet — run a sync once YOUTUBE_API_KEY is configured.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {recent.map((v) => (
              <div key={v.id} className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-0">
                <span
                  className={`text-eyebrow shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                    v.status === "confirmed" ? "bg-up/10 text-up" : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  {v.status}
                </span>
                <p className="text-ink min-w-0 flex-1 truncate text-sm">{v.title}</p>
                <a
                  href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
